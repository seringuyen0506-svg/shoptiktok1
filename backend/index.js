import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// Import vanilla puppeteer to access executablePath helper
import vanillaPuppeteer from 'puppeteer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create user data directory for persistent sessions
const USER_DATA_DIR = path.join(__dirname, 'tiktok_user_data');
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  console.log('✓ Created user data directory:', USER_DATA_DIR);
}

// Sử dụng stealth plugin để tránh bị phát hiện
puppeteer.use(StealthPlugin());

const app = express();

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// CORS configuration for Cloudflare Tunnel + Vercel + custom origins via env
// Use dynamic origin callback to echo allowed origins (needed when credentials=true)
const allowedOriginPatterns = [
  /\.trycloudflare\.com$/i,
  /\.vercel\.app$/i,
  /^http:\/\/localhost:\d+$/i,
  /^http:\/\/127\.0\.0\.1:\d+$/i
];

const envAllow = (process.env.ALLOW_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin or curl
    const ok = allowedOriginPatterns.some(r => r.test(origin)) || envAllow.includes(origin);
    return callback(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Random delay helper
const randomDelay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

// Resolve Chromium executable path reliably in container and local
function resolveChromiumExecutablePath() {
  try {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) {
      console.log('✓ Using Chrome from env:', envPath);
      return envPath;
    }
  } catch {}

  // Windows Chrome paths (official Chrome, not Chromium testing)
  if (process.platform === 'win32') {
    const windowsPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    for (const chromePath of windowsPaths) {
      try {
        if (chromePath && fs.existsSync(chromePath)) {
          console.log('✓ Found official Chrome at:', chromePath);
          return chromePath;
        }
      } catch {}
    }
  }

  try {
    // puppeteer >= v19 exposes executablePath()
    const p = typeof vanillaPuppeteer.executablePath === 'function' ? vanillaPuppeteer.executablePath() : null;
    if (p && fs.existsSync(p)) {
      console.log('⚠️  Using Puppeteer bundled Chromium:', p);
      return p;
    }
  } catch {}

  // Linux Chrome paths
  const candidates = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/opt/google/chrome/chrome'
  ];
  for (const c of candidates) {
    try { 
      if (fs.existsSync(c)) {
        console.log('✓ Found Chrome at:', c);
        return c;
      }
    } catch {}
  }
  
  console.log('⚠️  No Chrome found, using Puppeteer default');
  return null;
}

// Helper: Clean text
function textCleanup(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
}

// Helper: Parse sold text (1,2k -> 1200)
function parseSold(text) {
  if (!text) return null;
  let t = text.toLowerCase();
  
  // Remove keywords
  t = t.replace(/đã\s*bán|sold|đã|đang|lượt|sp|món bán ra|sản phẩm/gi, ' ').trim();
  
  // Parse k/m multiplier (1,2k -> 1200)
  const kmMatch = t.match(/([\d.,]+)\s*([kKmM])/);
  if (kmMatch) {
    const num = Number(kmMatch[1].replace(/[.,]/g, '.'));
    const mult = kmMatch[2].toLowerCase() === 'm' ? 1_000_000 : 1_000;
    return Math.round(num * mult).toString();
  }
  
  // Extract digits only
  const digits = t.replace(/[^\d]/g, '');
  if (digits) return digits;
  
  return null;
}

// ===== URL helpers =====

async function resolveShortUrl(inputUrl) {
  try {
    let current = inputUrl;
    for (let i = 0; i < 5; i++) {
      // Only try to resolve typical short domains
      if (!/\b(vm|vt)\.tiktok\.com\b|\/t\//i.test(current)) break;
      const resp = await axios.head(current, {
        maxRedirects: 0,
        validateStatus: s => s >= 200 && s < 400,
        timeout: 10000
      }).catch(e => e.response);
      if (resp && resp.status && resp.status >= 300 && resp.status < 400 && resp.headers?.location) {
        const loc = resp.headers.location.startsWith('http') ? resp.headers.location : new URL(resp.headers.location, current).href;
        current = loc;
      } else {
        break;
      }
    }
    return current;
  } catch {
    return inputUrl;
  }
}

// ======= SIMPLE FILE-BASED HISTORY STORE =======
const DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, '[]', 'utf-8');
  } catch (e) {
    console.error('Failed to ensure data directory:', e.message);
  }
}

function readHistory() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeHistory(arr) {
  ensureDataFile();
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(arr, null, 2), 'utf-8');
}

// ===== Locale auto-detect via proxy IP =====
function langFromCountry(country) {
  const cc = String(country || '').toUpperCase();
  const map = {
    US: 'en-US', GB: 'en-GB', AU: 'en-AU', CA: 'en-CA', SG: 'en-SG', PH: 'en-PH',
    VN: 'vi-VN', TH: 'th-TH', ID: 'id-ID', MY: 'ms-MY', KR: 'ko-KR', JP: 'ja-JP',
    CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK', IN: 'en-IN', DE: 'de-DE', FR: 'fr-FR',
    ES: 'es-ES', MX: 'es-MX', BR: 'pt-BR', IT: 'it-IT', NL: 'nl-NL', SE: 'sv-SE'
  };
  return map[cc] || (cc ? `en-${cc}` : 'en-US');
}

// ===== CAPTCHA single-flight state per page =====
const pageCaptchaState = new WeakMap(); // page -> { state: 'NONE'|'SEEN'|'SOLVING'|'SOLVED'|'FAILED', lastAt: number, promise?: Promise<any> }

// Small debounce helper
function debounceWait(ms = 350) {
  return new Promise((r) => setTimeout(r, ms));
}

// Wait for any of the selectors with short per-selector timeout
async function waitForAnySelector(page, selectors, totalTimeout = 6000) {
  const per = Math.max(500, Math.floor(totalTimeout / Math.max(1, selectors.length)));
  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: per, visible: true });
      if (el) {
        console.log('✓ Found selector:', sel);
        return el;
      }
    } catch { /* try next */ }
  }
  return null;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // keep pathname and search minimal; TikTok short URLs may vary, store full href
    return u.href;
  } catch {
    return (url || '').trim();
  }
}

function upsertHistoryItem({ url, shopName, shopSold, productName, productSold, note, shopId, shopSlug, productGrowth, shopGrowth }) {
  const list = readHistory();
  const nurl = normalizeUrl(url);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const shopSoldNum = parseSold(shopSold) ?? null;
  const productSoldNum = parseSold(productSold) ?? null;
  let item = list.find(it => it.url === nurl);
  if (!item) {
    item = {
      id: 'h_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 8),
      url: nurl,
      shopId: shopId || null,
      shopSlug: shopSlug || null,
      shopName: shopName || '',
      productName: productName || '',
      shopSold: shopSold || '',
      productSold: productSold || '',
      note: note || '',
      productGrowth: productGrowth || null,
      shopGrowth: shopGrowth || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      snapshots: []
    };
    list.push(item);
  } else {
    if (shopId && !item.shopId) item.shopId = shopId;
    if (shopSlug && !item.shopSlug) item.shopSlug = shopSlug;
    item.shopName = shopName || item.shopName;
    item.productName = productName || item.productName;
    item.shopSold = shopSold ?? item.shopSold;
    item.productSold = productSold ?? item.productSold;
    if (typeof note === 'string') item.note = note;
    if (productGrowth) item.productGrowth = productGrowth;
    if (shopGrowth) item.shopGrowth = shopGrowth;
    item.updatedAt = now.toISOString();
  }
  // upsert snapshot for today
  const existingSnap = item.snapshots.find(s => s.date === today);
  if (existingSnap) {
    existingSnap.shopSold = shopSoldNum;
    existingSnap.productSold = productSoldNum;
    existingSnap.updatedAt = now.toISOString();
  } else {
    item.snapshots.push({ date: today, shopSold: shopSoldNum, productSold: productSoldNum, createdAt: now.toISOString() });
  }
  writeHistory(list);
  return item;
}

// API: list history
app.get('/api/history', (req, res) => {
  try {
    const list = readHistory();
    res.json({ items: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: save/patch item (create or update by url)
app.post('/api/history/save', (req, res) => {
  try {
    const { url, shopName, shopSold, productName, productSold, note } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });
    const item = upsertHistoryItem({ url, shopName, shopSold, productName, productSold, note });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: delete item by id
app.delete('/api/history/:id', (req, res) => {
  try {
    const id = req.params.id;
    console.log('DELETE /api/history/', id);
    const list = readHistory();
    const next = list.filter(it => it.id !== id);
    if (next.length === list.length) return res.status(404).json({ error: 'not found' });
    writeHistory(next);
    console.log('Deleted. before=', list.length, ' after=', next.length);
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ error: e.message });
  }
});

// API: timeseries by id
app.get('/api/history/:id/timeseries', (req, res) => {
  try {
    const id = req.params.id;
    const list = readHistory();
    const item = list.find(it => it.id === id);
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json({ url: item.url, snapshots: item.snapshots || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper: Get text by CSS selector with retry
async function getTextByCss(page, selector, timeout = 20000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    const text = await page.$eval(selector, el => el.textContent);
    return textCleanup(text);
  } catch (err) {
    return null;
  }
}

// Helper: Get text by XPath with retry
async function getTextByXPath(page, xpath, timeout = 20000) {
  try {
    await page.waitForXPath(xpath, { visible: true, timeout });
    const [el] = await page.$x(xpath);
    if (!el) return null;
    const text = await page.evaluate(node => node.textContent, el);
    return textCleanup(text);
  } catch (err) {
    return null;
  }
}

// Helper: Try multiple selectors with proper waiting
async function getFirstMatch(page, cssList, xpathList) {
  console.log('  Trying selectors...');
  
  // Try all CSS selectors
  for (let i = 0; i < cssList.length; i++) {
    const css = cssList[i];
    console.log(`    CSS[${i}]: Waiting for element...`);
    const value = await getTextByCss(page, css, 10000);
    if (value) {
      console.log(`    ✓ Found via CSS[${i}]: "${value}"`);
      return { value, via: 'css', selector: css };
    }
  }
  
  // Try all XPath selectors
  for (let i = 0; i < xpathList.length; i++) {
    const xpath = xpathList[i];
    console.log(`    XPath[${i}]: Waiting for element...`);
    const value = await getTextByXPath(page, xpath, 10000);
    if (value) {
      console.log(`    ✓ Found via XPath[${i}]: "${value}"`);
      return { value, via: 'xpath', selector: xpath };
    }
  }
  
  console.log('    ✗ No match found');
  return { value: null, via: null, selector: null };
}

// Advanced DOM extraction với MULTIPLE SELECTORS (Product + Shop page support)
async function advancedDOMExtraction(page) {
  try {
    console.log('\n🔧 Advanced DOM extraction starting...');
    
    // Wait for page to be ready
    await page.waitForSelector('body', { timeout: 15000 });
    console.log('✓ Body loaded');
    
    // Scroll to trigger lazy loading
    console.log('Scrolling to load content...');
    await page.evaluate(async () => {
      // Scroll down slowly
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 300));
      }
      // Scroll back to top
      window.scrollTo(0, 0);
    });
    
    await randomDelay(2000, 3000);
    console.log('✓ Scroll completed');
    
    // Take screenshot for debugging
    try {
      await page.screenshot({ path: 'debug/dom_extraction_debug.png', fullPage: true });
      console.log('✓ Screenshot saved: debug/dom_extraction_debug.png');
    } catch (e) {
      console.log('Screenshot failed:', e.message);
    }
    
    // === MULTIPLE SELECTORS cho từng field ===
    
    console.log('\n=== Extracting SHOP NAME ===');
    const SHOP_NAME_CSS = [
      '#root > div > div > div > div.px-20.flex-grow.flex.justify-center.mb-80 > div > div.grid.grid-cols-2.\\32 xl\\:px-60.lg\\:px-32.px-20.align-items-start.overflow-visible.relative > div.sticky.h-full.overflow-y-auto.max-h-screen.pl-16 > div > a > div > div.flex.flex-row.items-center > div > span',
      '#root > div > div > div > div.px-20.flex-grow.flex.justify-center.mb-80 > div > div.flex.flex-col.gap-16.\\32 xl\\:px-60.lg\\:px-32.px-20.cursor-default.sticky.top-122.z-10.pb-32.pt-40.mt-128 > div.flex.h-64.justify-center.items-center.gap-16 > div.flex.flex-1.gap-6.flex-col > div > h1',
    ];
    const SHOP_NAME_XPATH = [
      '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[2]/div/a/div/div[1]/div/span',
      '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[1]/div[2]/div/h1',
    ];
    
    console.log('\n=== Extracting SHOP SOLD ===');
    const SHOP_SOLD_CSS = [
      '#root > div > div > div > div.px-20.flex-grow.flex.justify-center.mb-80 > div > div.grid.grid-cols-2.\\32 xl\\:px-60.lg\\:px-32.px-20.align-items-start.overflow-visible.relative > div.sticky.h-full.overflow-y-auto.max-h-screen.pl-16 > div > a > div > div.flex.flex-row.items-center > div > div > div:nth-child(2) > div:nth-child(1) > span.H4-Semibold.text-color-UIText1',
      '#root > div > div > div > div.px-20.flex-grow.flex.justify-center.mb-80 > div > div.flex.flex-col.gap-16.\\32 xl\\:px-60.lg\\:px-32.px-20.cursor-default.sticky.top-122.z-10.pb-32.pt-40.mt-128 > div.flex.flex-1.gap-8.flex-col > div > div:nth-child(3) > div.font-semibold',
    ];
    const SHOP_SOLD_XPATH = [
      '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[2]/div/a/div/div[1]/div/div/div[2]/div[1]/span[1]',
      '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[2]/div/div[2]/div[1]',
    ];
    
    console.log('\n=== Extracting PRODUCT NAME ===');
    const PRODUCT_NAME_CSS = [
      '#root > div > div > div > div.px-20.flex-grow.flex.justify-center.mb-80 > div > div.grid.grid-cols-2.\\32 xl\\:px-60.lg\\:px-32.px-20.align-items-start.overflow-visible.relative > div.sticky.h-full.overflow-y-auto.max-h-screen.pl-16 > div > div:nth-child(1) > h1 > span',
    ];
    const PRODUCT_NAME_XPATH = [
      '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[2]/div/div[1]/h1/span',
    ];
    
    console.log('\n=== Extracting PRODUCT SOLD ===');
    const PRODUCT_SOLD_CSS = [
      '#root > div > div > div > div.px-20.flex-grow.flex.justify-center.mb-80 > div > div.grid.grid-cols-2.\\32 xl\\:px-60.lg\\:px-32.px-20.align-items-start.overflow-visible.relative > div.sticky.h-full.overflow-y-auto.max-h-screen.pl-16 > div > div:nth-child(1) > div:nth-child(5) > div.flex.flex-row.items-center > span',
    ];
    const PRODUCT_SOLD_XPATH = [
      '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[2]/div/div[1]/div[4]/div[2]/span',
    ];
    
    // Extract với multiple selector fallback
    const shopNameResult = await getFirstMatch(page, SHOP_NAME_CSS, SHOP_NAME_XPATH);
    const shopSoldResult = await getFirstMatch(page, SHOP_SOLD_CSS, SHOP_SOLD_XPATH);
    const productNameResult = await getFirstMatch(page, PRODUCT_NAME_CSS, PRODUCT_NAME_XPATH);
    const productSoldResult = await getFirstMatch(page, PRODUCT_SOLD_CSS, PRODUCT_SOLD_XPATH);
    
    const result = {
      shopName: shopNameResult.value || '',
      shopSold: parseSold(shopSoldResult.value) || shopSoldResult.value || '',
      productName: productNameResult.value || '',
      productSold: parseSold(productSoldResult.value) || productSoldResult.value || ''
    };
    
    console.log('\n=== FINAL RESULT ===');
    console.log('Shop Name:', result.shopName || '(empty)');
    console.log('Shop Sold:', result.shopSold || '(empty)');
    console.log('Product Name:', result.productName || '(empty)');
    console.log('Product Sold:', result.productSold || '(empty)');
    
    return result;
    
  } catch (e) {
    console.log('❌ Advanced DOM extraction failed:', e.message);
    return null;
  }
}

// ===== CAPTCHA DETECTION + SOLVER =====
async function detectCaptchaType(page) {
  // Debounce to stabilize DOM
  await debounceWait(350);
  const info = await page.evaluate(() => {
    const lower = (s) => (s || '').toLowerCase();
    const bodyText = lower(document.body.innerText || '');
    const hasCaptchaWord = /captcha|verify|slide to verify|select 2 objects|rotate|challenge|are you human|robot check|security check|human verification/i.test(bodyText);
    const iframes = Array.from(document.querySelectorAll('iframe'))
      .map(f => (f.src || '').toLowerCase())
      .filter(u => u.includes('captcha') || u.includes('verify') || u.includes('challenge'));
    let type = 'NONE';
    if (hasCaptchaWord || iframes.length) {
      if (/select 2 objects|same shape/i.test(bodyText)) type = 'TIKTOK_OBJ';
      else if (/rotate/i.test(bodyText)) type = 'TIKTOK_ROTATE';
      else type = 'ALL_CAPTCHA_SLIDE';
    }
    return { type, iframesCount: iframes.length, textSeen: hasCaptchaWord };
  });
  return info.type;
}

async function solveCaptchaIfNeeded(page, apiKey) {
  try {
    // Single-flight guard
    const st = pageCaptchaState.get(page) || { state: 'NONE', lastAt: Date.now() };
    if (st.state === 'SOLVING' && st.promise) {
      console.log('⏳ CAPTCHA solving in progress, awaiting existing promise...');
      return await st.promise; // await the in-flight solve
    }
    // Detect type first
    const detected = await detectCaptchaType(page);
    if (detected === 'NONE') {
      pageCaptchaState.set(page, { state: 'NONE', lastAt: Date.now() });
      return { success: true, noop: true };
    }
  pageCaptchaState.set(page, { state: 'SEEN', lastAt: Date.now() });

  // 1. Locate CAPTCHA region robustly (main page, iframes, canvas, or text container)
  await debounceWait(400); // stabilize DOM before capture
    console.log('📸 Capturing CAPTCHA screenshot...');
    
    // Try multiple selectors for SLIDE CAPTCHA specifically
    const slideSelectors = [
      'img[src*="captcha"]',
      'img[alt*="captcha"]', 
      'canvas[class*="captcha"]',
      '[class*="captcha"] img',
      '[class*="captcha"] canvas',
      '[id*="captcha"] img',
      '[id*="captcha"] canvas',
      // Specific TikTok slide selectors
      'img.secsdk-captcha-img',
      'canvas.secsdk-captcha-canvas',
      '.captcha_verify_img_slide img',
      '[class*="verify"] img',
      '[class*="slide"] img'
    ];
    
    let captchaElement = null;
    
    // Try main page first
    for (const sel of slideSelectors) {
      captchaElement = await page.$(sel).catch(() => null);
      if (captchaElement) {
        console.log(`✓ Found CAPTCHA element: ${sel}`);
        break;
      }
    }
    
    let captchaClip = null; // {x,y,width,height}

    // If not found on main page, search inside iframes with url including captcha/verify
    if (!captchaElement) {
      console.log('⚠️ Not found in main page, checking iframes...');
      const frames = page.frames();
      for (const f of frames) {
        const furl = f.url().toLowerCase();
        if (furl.includes('captcha') || furl.includes('verify')) {
          console.log(`  Checking iframe: ${furl.substring(0, 80)}...`);
          try {
            for (const sel of slideSelectors) {
              captchaElement = await f.$(sel).catch(() => null);
              if (captchaElement) {
                console.log(`  ✓ Found in iframe: ${sel}`);
                break;
              }
            }
            if (captchaElement) break;
          } catch { /* ignore */ }
        }
      }
    }

    // If still not found, detect container by text and compute bounding rect
    if (!captchaElement) {
      const rect = await page.evaluate(() => {
        const matches = [];
        const textNeedles = ['verify', 'captcha', 'slide', 'rotate', 'select'];
        const elements = Array.from(document.querySelectorAll('body *'));
        for (const el of elements) {
          try {
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') continue;
            const txt = (el.innerText || '').toLowerCase();
            if (!txt) continue;
            if (textNeedles.some(n => txt.includes(n))) {
              const r = el.getBoundingClientRect();
              if (r && r.width > 60 && r.height > 60) {
                matches.push({ x: r.x, y: r.y, width: r.width, height: r.height, area: r.width * r.height });
              }
            }
          } catch { /* ignore */ }
        }
        if (matches.length) {
          matches.sort((a,b) => b.area - a.area);
          const { x, y, width, height } = matches[0];
          return { x: Math.max(0, x), y: Math.max(0, y), width, height };
        }
        return null;
      });

      if (rect) {
        captchaClip = rect;
      }
    }

    let screenshot;
    if (captchaElement) {
      // Get bounding box to validate size
      const box = await captchaElement.boundingBox().catch(() => null);
      if (box) {
        console.log(`📐 CAPTCHA element size: ${Math.round(box.width)}x${Math.round(box.height)}px`);
        captchaClip = { x: box.x, y: box.y, width: box.width, height: box.height };
        
        // If element too small, might be wrong - try parent
        if (box.width < 200 || box.height < 100) {
          console.log('⚠️ Element too small, trying parent container...');
          try {
            const parent = await page.evaluateHandle(el => el.parentElement, captchaElement);
            const parentBox = await parent.asElement().boundingBox();
            if (parentBox && parentBox.width > box.width && parentBox.height > box.height) {
              console.log(`📐 Parent size: ${Math.round(parentBox.width)}x${Math.round(parentBox.height)}px`);
              captchaElement = parent.asElement();
              captchaClip = { x: parentBox.x, y: parentBox.y, width: parentBox.width, height: parentBox.height };
            }
          } catch (e) {
            console.log('Parent check failed:', e.message);
          }
        }
      }
      
      screenshot = await captchaElement.screenshot({ encoding: 'base64' });
      console.log('✓ Screenshot captured (element)');
    } else if (captchaClip) {
      // Clip screenshot to detected container
      screenshot = await page.screenshot({ encoding: 'base64', clip: captchaClip }).catch(() => null);
      if (!screenshot) {
        screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
      }
      console.log('✓ Screenshot captured (clip)');
    } else {
      // Fallback: full page (last resort)
      screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
      const vp = await page.viewport();
      captchaClip = { x: 0, y: 0, width: vp.width, height: vp.height };
      console.log('✓ Screenshot captured (full page fallback)');
    }
    
    // DEBUG: Save screenshot to file for inspection
    try {
      const debugPath = `debug/captcha_${Date.now()}.png`;
      const buffer = Buffer.from(screenshot, 'base64');
      fs.writeFileSync(debugPath, buffer);
      console.log(`🖼️  Screenshot saved to ${debugPath}`);
      console.log(`📊 Image stats: ${buffer.length} bytes, base64: ${screenshot.length} chars`);
      
      // Validate screenshot size
      if (buffer.length < 5000) {
        console.log('⚠️ WARNING: Screenshot very small, might be wrong element!');
      } else if (buffer.length > 5000000) {
        console.log('⚠️ WARNING: Screenshot very large, might be full page!');
      } else {
        console.log('✓ Screenshot size looks reasonable');
      }
    } catch (e) {
      console.log('⚠️ Failed to save debug screenshot:', e.message);
    }
    
    // 2. Decide captcha type from detection + UA
    let captchaType = 'ALL_CAPTCHA_SLIDE';
    if (detected === 'TIKTOK_OBJ') captchaType = 'TIKTOK_OBJ';
    else if (detected === 'TIKTOK_ROTATE') {
      const userAgent = await page.evaluate(() => navigator.userAgent);
      captchaType = userAgent.includes('TikTok') ? 'TIKTOK_ROTATE_APP' : 'TIKTOK_ROTATE_WEB';
    }
    
    console.log(`🎯 Detected CAPTCHA type: ${captchaType}`);
    
    // 3. Build request
    const payload = {
      Apikey: apiKey.trim(),
      Type: captchaType,
      Image: screenshot
    };
    
    console.log(`📦 Payload: Type=${captchaType}, Image size=${screenshot.length} chars`);
    
    // Special case: TIKTOK_ROTATE_WEB needs 2 URL images
    if (captchaType === 'TIKTOK_ROTATE_WEB') {
      const innerImg = await page.$eval('img.captcha-inner, [class*="inner"]', el => el.src).catch(() => null);
      const outerImg = await page.$eval('img.captcha-outer, [class*="outer"]', el => el.src).catch(() => null);
      
      if (innerImg && outerImg) {
        payload.URL_Image1 = innerImg;
        payload.URL_Image2 = outerImg;
        delete payload.Image;
      }
    }
    
    // 4. Send to hmcaptcha with retries and optional polling
  console.log('📤 Sending to hmcaptcha.com...');
  // Wrap the entire solving flow in a promise and store it, so other callers can await it
  let resolver;
  const solvingPromise = new Promise((resolve) => { resolver = resolve; });
  pageCaptchaState.set(page, { state: 'SOLVING', lastAt: Date.now(), promise: solvingPromise, resolver });
    const maxAttempts = 3;
    let lastErr = null;
    let resultData = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await axios.post('https://hmcaptcha.com/Recognition?wait=1', payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        });
        console.log(`hmcaptcha response (attempt ${attempt}):`, resp.data);

        if (resp.data.Code !== 0) {
          throw new Error(resp.data.Message || `API Error: Code ${resp.data.Code}`);
        }
        if (resp.data.Status === 'ERROR') {
          const errMsg = resp.data.Message || 'Solver returned ERROR status';
          console.log(`⚠️ Solver attempt ${attempt} failed: ${errMsg}`);
          
          // Add helpful context for "Cannot solve"
          if (errMsg.includes('Cannot solve')) {
            console.log('💡 Possible reasons:');
            console.log('   - Screenshot không chứa slide puzzle rõ ràng');
            console.log('   - Chụp sai vùng (không phải CAPTCHA)');
            console.log('   - Image quá nhỏ hoặc bị blur');
            console.log('   - CAPTCHA type không match với ảnh');
          }
          
          throw new Error(errMsg);
        }
        if (resp.data.Status === 'SUCCESS' && resp.data.Data) {
          resultData = resp.data.Data;
          break;
        }
        // If PENDING/PROCESSING unexpectedly, poll getResult up to 12s
        const taskId = resp.data.TaskId;
        if (taskId) {
          const deadline = Date.now() + 12000;
          while (Date.now() < deadline) {
            const r = await axios.get(`https://hmcaptcha.com/getResult?apikey=${encodeURIComponent(payload.Apikey)}&taskid=${encodeURIComponent(taskId)}`, { timeout: 15000 });
            console.log('getResult:', r.data);
            if (r.data.Status === 'SUCCESS' && r.data.Data) {
              resultData = r.data.Data;
              break;
            }
            if (r.data.Status === 'ERROR') throw new Error(r.data.Message || 'Solver ERROR on getResult');
            await new Promise(res => setTimeout(res, 800 + Math.random() * 700));
          }
          if (resultData) break;
        }
        lastErr = new Error('Unexpected solver state without Data');
      } catch (e) {
        lastErr = e;
        const backoff = 600 + Math.floor(Math.random() * 900);
        console.log(`⚠️ Solver attempt ${attempt} failed: ${e.message}. Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        // Re-capture if attempt > 1 (image might rotate/change)
        if (attempt < maxAttempts) {
          try {
            const rec = await page.screenshot({ encoding: 'base64', clip: captchaClip || undefined, fullPage: !captchaClip });
            payload.Image = rec;
          } catch { /* ignore */ }
        }
      }
    }
    if (!resultData) {
      const out = { success: false, error: lastErr ? lastErr.message : 'Solver failed without data' };
      pageCaptchaState.set(page, { state: 'FAILED', lastAt: Date.now() });
      resolver(out);
      return out;
    }

    console.log('✅ CAPTCHA solved:', resultData);
  pageCaptchaState.set(page, { state: 'SOLVED', lastAt: Date.now() });
    
    // 6. Execute action based on type
    if (captchaType === 'ALL_CAPTCHA_SLIDE') {
      const { offset, x, y } = resultData;
      console.log(`🎯 Sliding: offset=${offset}px at (${x}, ${y})`);
      // If solver returns absolute coords use them; otherwise, compute from clip center
      const baseX = (typeof x === 'number') ? x : (captchaClip ? captchaClip.x + captchaClip.width * 0.15 : 200);
      const baseY = (typeof y === 'number') ? y : (captchaClip ? captchaClip.y + captchaClip.height * 0.5 : 300);
      
      await page.mouse.move(baseX, baseY);
      await page.mouse.down();
      await page.mouse.move(baseX + offset, baseY, { steps: 15 });
      await new Promise(r => setTimeout(r, 100));
      await page.mouse.up();
      
    } else if (captchaType === 'TIKTOK_OBJ') {
      const { raw } = resultData;
      console.log(`🎯 Clicking 2 objects: ${raw}`);
      const bbox = captchaClip || (await (captchaElement ? captchaElement.boundingBox() : null));
      
      if (!bbox || !bbox.width || !bbox.height) {
        console.error('❌ No valid bounding box for TIKTOK_OBJ');
        return { success: false, error: 'Invalid bbox for object selection' };
      }
      
      // Parse raw coordinates: "0.61413,0.62064|0.48913,0.819767"
      // xRatio,yRatio|xRatio,yRatio...
      const points = raw.split('|');
      console.log(`  → Found ${points.length} points to click`);
      
      for (const point of points) {
        const [xRatio, yRatio] = point.split(',').map(parseFloat);
        
        // ⚠️ FIX: Dùng xRatio cho X, yRatio cho Y (KHÔNG phải xRatio cho cả hai!)
        // Theo docs: x = xn * image.renderWidth, y = yn * image.renderHeight
        const clickX = bbox.x + (xRatio * bbox.width);
        const clickY = bbox.y + (yRatio * bbox.height);  // ← yn, không phải xn!
        
        console.log(`  → Click at (${clickX.toFixed(1)}, ${clickY.toFixed(1)}) from ratio (${xRatio}, ${yRatio})`);
        
        await page.mouse.click(clickX, clickY);
        await new Promise(r => setTimeout(r, 500));
      }
      
    } else if (captchaType === 'TIKTOK_ROTATE_APP') {
      const { angle, point_slide } = resultData;
      console.log(`🎯 Rotating APP: ${angle}° at (${point_slide.x}, ${point_slide.y})`);
      
      const sliderEl = await page.$('.captcha-slider, [class*="slider"]').catch(() => null);
      if (sliderEl) {
        const sliderBox = await sliderEl.boundingBox();
        let offset = angle * (sliderBox.width / 180);
        
        // 📱 PHONE CORRECTION - Theo tài liệu chính thức:
        // "Tiktok thêm một số tỉ lệ khiến cho kéo theo offset không chính xác"
        // "Nếu bị thì fix bằng công thức: offset = offset * (45 / 57)"
        offset = offset * (45 / 57);
        console.log(`  → Offset corrected for phone: ${offset}px`);
        
        await page.mouse.move(point_slide.x, point_slide.y);
        await page.mouse.down();
        await page.mouse.move(point_slide.x + offset, point_slide.y, { steps: 15 });
        await new Promise(r => setTimeout(r, 100));
        await page.mouse.up();
      }
      
    } else if (captchaType === 'TIKTOK_ROTATE_WEB') {
      const { angle } = resultData;
      console.log(`🎯 Rotating WEB: ${angle}°`);
      
      const sliderEl = await page.$('.captcha-slider, [class*="rotate-control"], [class*="slider"]').catch(() => null);
      if (sliderEl) {
        const sliderBox = await sliderEl.boundingBox();
        const offset = angle * (sliderBox.width / 180);
        
        await page.mouse.move(sliderBox.x, sliderBox.y + sliderBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(sliderBox.x + offset, sliderBox.y + sliderBox.height / 2, { steps: 15 });
        await new Promise(r => setTimeout(r, 100));
        await page.mouse.up();
      }
    }
    
    // Validate resultData before declaring success
    const valid = (
      (captchaType === 'ALL_CAPTCHA_SLIDE' && (typeof resultData.offset === 'number')) ||
      (captchaType === 'TIKTOK_OBJ' && typeof resultData.raw === 'string' && resultData.raw.includes(',')) ||
      ((captchaType === 'TIKTOK_ROTATE_APP' || captchaType === 'TIKTOK_ROTATE_WEB') && typeof resultData.angle === 'number')
    );
    if (!valid) {
      const out = { success: false, error: 'Invalid solver data' };
      pageCaptchaState.set(page, { state: 'FAILED', lastAt: Date.now() });
      resolver(out);
      return out;
    }

    console.log('✅ Action executed successfully');
    const out = { success: true, captchaType, data: resultData };
    resolver(out);
    return out;
    
  } catch (error) {
    console.error('❌ CAPTCHA solve error:', error.message);
    const out = { success: false, error: error.message };
    // Try to resolve any in-flight waiter via stored resolver if present
    const current = pageCaptchaState.get(page) || {};
    if (current && typeof current.resolver === 'function') {
      try { current.resolver(out); } catch {}
    }
    pageCaptchaState.set(page, { state: 'FAILED', lastAt: Date.now() });
    return out;
  }
}

// Helper function to create launch options with persistent session
function createLaunchOptions(usePersistent = true) {
  const options = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      
      // ✅ CRITICAL: Disable automation detection
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      
      // ✅ More stealth flags
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-browser-side-navigation',
      '--disable-gpu-sandbox',
      
      // ✅ User agent hints
      '--user-agent-metadata={"platform":"Windows","platformVersion":"10.0.0","architecture":"x86","model":"","mobile":false}',
      
      // ✅ Allow extensions to work properly
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb'
    ],
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
    executablePath: resolveChromiumExecutablePath() || undefined
  };

  // Add persistent user data directory if enabled
  if (usePersistent) {
    options.userDataDir = USER_DATA_DIR;
    console.log('✓ Using persistent session:', USER_DATA_DIR);
  }

  return options;
}

// Check API Key endpoint
app.post('/api/check-apikey', async (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey || !apiKey.trim()) {
    return res.json({ error: 'API Key không được để trống' });
  }
  
  console.log('🔑 Checking hmcaptcha API Key...');
  
  try {
    // hmcaptcha KHÔNG có endpoint getBalance
    // Phải test bằng cách gửi một test image nhỏ
    // Tạo một ảnh test đơn giản (1x1 pixel base64)
    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    console.log('Testing API key with a test recognition request...');
    const response = await axios.post('https://hmcaptcha.com/Recognition?wait=1', {
      Apikey: apiKey.trim(),
      Type: 'ALL_CAPTCHA_SLIDE',
      Image: testImage
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    
    console.log('hmcaptcha response:', response.data);
    
    // Check response
    if (response.data) {
      if (response.data.Code === 0) {
        // API Key hợp lệ và có balance
        console.log('✅ hmcaptcha API Key hợp lệ!');
        
        return res.json({
          success: true,
          balance: 'Unknown (no balance endpoint)',
          status: 'Active',
          service: 'hmcaptcha',
          tasks: 'Test successful',
          message: 'API Key đã được xác thực thành công!'
        });
      } else if (response.data.Code === 1) {
        // API Key không hợp lệ hoặc hết tiền
        const errorMsg = response.data.Message || 'API Key không hợp lệ hoặc hết tiền';
        console.log('❌ hmcaptcha error:', errorMsg);
        
        return res.json({
          error: `hmcaptcha: ${errorMsg}`
        });
      } else {
        return res.json({
          error: `hmcaptcha: Unexpected Code ${response.data.Code}`
        });
      }
    } else {
      return res.json({
        error: 'hmcaptcha: No response data'
      });
    }
  } catch (error) {
    console.error('❌ API Key check failed:', error.message);
    
    // Parse error response
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      console.log('Error response:', errorData);
      
      if (errorData.Code === 1) {
        return res.json({ 
          error: `hmcaptcha: ${errorData.Message || 'API Key không hợp lệ'}` 
        });
      }
    }
    
    return res.json({ 
      error: 'Lỗi kết nối hmcaptcha: ' + error.message 
    });
  }
});

// ======== ASYNC CRAWL JOBS (to avoid 524) ========
const crawlJobs = new Map();

// Start async crawl job
app.post('/api/crawl-async', async (req, res) => {
  try {
    const { links, proxy, apiKey, note, concurrency, prefs } = req.body || {};
    if (!Array.isArray(links) || links.length === 0) return res.status(400).json({ error: 'links must be a non-empty array' });
    const id = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const job = {
      id,
      status: 'running',
      createdAt: new Date().toISOString(),
      total: links.length,
      completed: 0,
      results: []
    };
    crawlJobs.set(id, job);
    res.json({ jobId: id });

    // process in background using existing /api/crawl in small batches
    setImmediate(async () => {
      const SELF_PORT = process.env.PORT || 8080;
      try {
        const batchSize = 2; // small batches keep memory lower and provide frequent progress updates
        for (let i = 0; i < links.length; i += batchSize) {
          const chunk = links.slice(i, i + batchSize);
          const response = await axios.post(`http://localhost:${SELF_PORT}/api/crawl`, {
            links: chunk, proxy, apiKey, note, concurrency, prefs
          }, { timeout: 600000 });
          const { results } = response.data || {};
          if (Array.isArray(results)) {
            job.results.push(...results);
            job.completed = Math.min(job.results.length, job.total);
          }
        }
        job.status = 'done';
        job.finishedAt = new Date().toISOString();
      } catch (e) {
        job.status = 'error';
        job.error = e.message;
        job.finishedAt = new Date().toISOString();
      }
      // Optional: cleanup old jobs later
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get async crawl job status
app.get('/api/crawl-async/:id', (req, res) => {
  const job = crawlJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

// Dry-run endpoint to test CAPTCHA solving on a single URL without extraction
app.post('/api/captcha-dry-run', async (req, res) => {
  const { url, apiKey } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });

  let browser;
  try {
    const launchOptions = {
      headless: 'new',
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors'
      ],
      executablePath: resolveChromiumExecutablePath() || undefined
    };
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await randomDelay(1200, 2000);
    const typ = await detectCaptchaType(page);
    if (typ === 'NONE') {
      await browser.close();
      return res.json({ success: true, message: 'No CAPTCHA detected' });
    }
    const out = await solveCaptchaIfNeeded(page, apiKey);
    await browser.close();
    return res.json({ ...out, detectedType: typ });
  } catch (e) {
    if (browser) try { await browser.close(); } catch {}
    return res.status(500).json({ error: e.message });
  }
});

// Crawl Shop Products - using scrapecreators API
app.post('/api/crawl-shop', async (req, res) => {
  const { shopUrl, amount = 30, apiKey, note } = req.body;
  
  if (!shopUrl) {
    return res.status(400).json({ error: 'shopUrl is required' });
  }
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required for scrapecreators.com' });
  }
  
  // Validate shop URL format - scrapecreators REQUIRES /shop/store/ format
  const trimmedUrl = shopUrl.trim();
  if (!trimmedUrl.includes('/shop/store/')) {
    return res.status(400).json({ 
      error: 'ScapeCreators API requires /shop/store/ URL format',
      example: 'https://www.tiktok.com/shop/store/shopname/123456',
      hint: 'Use full TikTok Shop Store URL, not @username format'
    });
  }

  try {
    console.log(`🏪 [Shop Crawl] URL: ${shopUrl}`);
    console.log(` [Shop Crawl] API Key: ${apiKey.substring(0, 10)}...`);
    
    // Extract shop ID from URL if it's a full store URL
    // Format: https://www.tiktok.com/shop/store/shopname/SHOP_ID
    let shopIdentifier = shopUrl.trim();
    const storeMatch = shopUrl.match(/\/shop\/store\/([^\/]+)\/(\d+)/);
    if (storeMatch) {
      shopIdentifier = storeMatch[2]; // Use shop ID
      console.log(`🔍 [Shop Crawl] Extracted Shop ID: ${shopIdentifier}`);
    } else {
      // Try to extract @username format
      const usernameMatch = shopUrl.match(/@([^\/\?]+)/);
      if (usernameMatch) {
        shopIdentifier = usernameMatch[1];
        console.log(`🔍 [Shop Crawl] Extracted Username: ${shopIdentifier}`);
      }
    }
    
    // Prepare request
    const requestConfig = {
      method: 'GET',
      url: `https://api.scrapecreators.com/v1/tiktok/shop/products`,
      headers: {
        'x-api-key': apiKey.trim(),
        'Accept': 'application/json'
      },
      params: {
        url: shopIdentifier
      },
      timeout: 120000, // 2 minutes
      validateStatus: function (status) {
        return status >= 200 && status < 600; // Don't throw on any status
      }
    };
    
    console.log(`📡 [Shop Crawl] Calling API with url parameter: ${shopIdentifier}`);
    
    // Call scrapecreators API
    const response = await axios(requestConfig);
    
    console.log(`📥 [Shop Crawl] Response status: ${response.status}`);
    
    // Handle non-200 responses
    if (response.status !== 200) {
      console.error(`❌ [Shop Crawl] API error ${response.status}:`, response.data);
      
      let errorMessage = 'API request failed';
      if (response.data?.message) {
        errorMessage = response.data.message;
      } else if (response.data?.error) {
        errorMessage = response.data.error;
      } else if (response.status === 401) {
        errorMessage = 'Invalid API key';
      } else if (response.status === 402) {
        errorMessage = 'Out of credits - Please buy more credits at scrapecreators.com';
      } else if (response.status === 403) {
        errorMessage = 'Access denied - check API key permissions';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded - please wait';
      } else if (response.status === 500) {
        // Special handling for 500 with 'initialProducts' error
        if (response.data?.message?.includes('initialProducts')) {
          errorMessage = 'ScapeCreators API error: Cannot crawl this shop. Try a different shop or contact adrian@thewebscrapingguy.com';
        } else {
          errorMessage = 'API server error - try again later or contact support';
        }
      }
      
      throw new Error(errorMessage);
    }

    if (!response.data || !response.data.success) {
      console.error('❌ [Shop Crawl] API returned unsuccessful response:', response.data);
      throw new Error(response.data?.error || 'API returned unsuccessful response');
    }

    const { shopInfo, products } = response.data;
    
    if (!shopInfo || !products) {
      console.error('❌ [Shop Crawl] Missing shopInfo or products in response');
      throw new Error('Invalid API response structure');
    }
    
    console.log(`✅ [Shop Crawl] Shop: ${shopInfo.shop_name}`);
    console.log(`✅ [Shop Crawl] Sold: ${shopInfo.format_sold_count || shopInfo.sold_count}`);
    console.log(`✅ [Shop Crawl] Products fetched: ${products.length}`);

    // Save each product to history
    const savedProducts = [];
    for (const product of products) {
      try {
        const productUrl = product.seo_url?.canonical_url || `https://www.tiktok.com/shop/product/${product.product_id}`;
        const shopSold = shopInfo.sold_count || shopInfo.format_sold_count || '';
        const productSold = product.sold_info?.sold_count || '';
        const productPrice = product.product_price_info?.sale_price_format || '';
        
        const historyItem = upsertHistoryItem({
          url: productUrl,
          shopName: shopInfo.shop_name,
          shopSold: String(shopSold),
          productName: product.title,
          productSold: String(productSold),
          note: note || `Crawled from shop: ${shopInfo.shop_name}`,
          shopId: shopInfo.seller_id,
          shopSlug: shopInfo.shop_name.toLowerCase().replace(/\s+/g, '-')
        });

        savedProducts.push({
          id: historyItem.id,
          url: productUrl,
          shopName: shopInfo.shop_name,
          productName: product.title,
          shopSold: String(shopSold),
          productSold: String(productSold),
          price: productPrice,
          rating: product.rate_info?.score || null,
          reviewCount: product.rate_info?.review_count || null,
          image: product.image?.url_list?.[0] || null
        });
      } catch (err) {
        console.error(`⚠️ Error saving product ${product.product_id}:`, err.message);
      }
    }

    return res.json({
      success: true,
      shopInfo: {
        name: shopInfo.shop_name,
        soldCount: shopInfo.sold_count,
        rating: shopInfo.shop_rating,
        followers: shopInfo.followers_count,
        productCount: shopInfo.on_sell_product_count,
        logo: shopInfo.shop_logo?.url_list?.[0]
      },
      products: savedProducts,
      totalSaved: savedProducts.length
    });

  } catch (error) {
    console.error('❌ [Shop Crawl] Error:', error.message);
    
    if (error.response) {
      console.error('❌ [Shop Crawl] Response status:', error.response.status);
      console.error('❌ [Shop Crawl] Response data:', JSON.stringify(error.response.data, null, 2));
      
      // API returned error response
      return res.status(error.response.status || 500).json({
        error: `API Error: ${error.response.data?.error || error.response.data?.message || error.message}`,
        details: error.response.data,
        hint: 'Check API documentation at https://scrapecreators.com/docs'
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ 
        error: 'Request timeout - API took too long to respond',
        hint: 'Try with fewer products or try again later'
      });
    }
    
    return res.status(500).json({ 
      error: error.message,
      hint: 'Verify: 1) API key is valid, 2) Shop URL format is correct, 3) You have sufficient credits'
    });
  }
});

// Analyze shop/products growth with DeepSeek AI
app.post('/api/analyze-growth', async (req, res) => {
  const { shopId, shopName, deepseekApiKey } = req.body;
  
  console.log('📊 [Analyze Growth] Request received:', { shopId, shopName, hasApiKey: !!deepseekApiKey });
  
  if (!shopId && !shopName) {
    return res.status(400).json({ error: 'shopId or shopName is required' });
  }
  
  if (!deepseekApiKey) {
    return res.status(400).json({ error: 'DeepSeek API key is required' });
  }

  try {
    console.log(`📊 [Step 1] Analyzing growth for shop: ${shopName || shopId}`);
    
    // Get all history items for this shop
    const historyData = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    
    // Handle both formats: array or object with items
    let items;
    if (Array.isArray(historyData)) {
      items = historyData;
    } else if (historyData.items && Array.isArray(historyData.items)) {
      items = historyData.items;
    } else {
      items = [];
    }
    
    console.log(`📊 [Step 2] Total history items: ${items.length}`);
    
    const shopItems = items.filter(item => {
      if (shopId) return item.shopId === shopId;
      if (shopName) return item.shopName === shopName;
      return false;
    });

    console.log(`📊 [Step 3] Shop items found: ${shopItems.length}`);

    if (shopItems.length === 0) {
      return res.status(404).json({ error: 'No data found for this shop' });
    }

    // Group by product and collect snapshots
    const productAnalysis = {};
    let shopSoldHistory = [];
    
    for (const item of shopItems) {
      const productKey = item.url;
      
      if (!productAnalysis[productKey]) {
        productAnalysis[productKey] = {
          productName: item.productName,
          url: item.url,
          snapshots: []
        };
      }
      
      // Add main record (parse to number immediately)
      if (item.createdAt) {
        const productSoldNum = parseInt(parseSold(item.productSold) || '0', 10);
        const shopSoldNum = parseInt(parseSold(item.shopSold) || '0', 10);
        
        productAnalysis[productKey].snapshots.push({
          date: item.createdAt,
          productSold: productSoldNum,
          shopSold: shopSoldNum
        });
        
        // Collect shop sold data from main record
        shopSoldHistory.push({
          date: item.createdAt,
          sold: shopSoldNum
        });
      }
      
      // Add historical snapshots (if they exist)
      if (item.snapshots && Array.isArray(item.snapshots)) {
        for (const snap of item.snapshots) {
          const snapProductSold = typeof snap.productSold === 'number' 
            ? snap.productSold 
            : parseInt(parseSold(snap.productSold) || '0', 10);
          const snapShopSold = typeof snap.shopSold === 'number'
            ? snap.shopSold
            : parseInt(parseSold(snap.shopSold) || '0', 10);
          
          productAnalysis[productKey].snapshots.push({
            date: snap.createdAt || snap.date,
            productSold: snapProductSold,
            shopSold: snapShopSold
          });
          
          // Also collect shop sold from snapshots
          shopSoldHistory.push({
            date: snap.createdAt || snap.date,
            sold: snapShopSold
          });
        }
      }
    }

    // Sort snapshots by date
    for (const key in productAnalysis) {
      productAnalysis[key].snapshots.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
    }
    
    shopSoldHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Prepare data summary for AI
    const productSummaries = Object.values(productAnalysis).map(p => {
      const snaps = p.snapshots.filter(s => s.productSold != null && !isNaN(s.productSold));
      
      // Need at least 1 snapshot to show product data
      if (snaps.length === 0) return null;
      
      const first = snaps[0];
      const last = snaps[snaps.length - 1];
      const growth = last.productSold - first.productSold;
      
      // Calculate growth rate (handle edge cases)
      let growthRate = 'N/A';
      if (snaps.length >= 2 && first.productSold > 0) {
        growthRate = ((growth / first.productSold) * 100).toFixed(1) + '%';
      } else if (snaps.length === 1) {
        growthRate = 'Chưa đủ dữ liệu';
      }
      
      return {
        name: p.productName,
        firstCrawl: { date: first.date, sold: first.productSold },
        lastCrawl: { date: last.date, sold: last.productSold },
        totalGrowth: growth,
        growthRate: growthRate,
        dataPoints: snaps.length
      };
    }).filter(Boolean);

    // Shop growth summary
    let shopGrowth = null;
    
    // Remove duplicates and sort by date
    const uniqueShopHistory = [];
    const seenDates = new Set();
    for (const item of shopSoldHistory) {
      const dateKey = new Date(item.date).toISOString();
      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        uniqueShopHistory.push(item);
      }
    }
    
    if (uniqueShopHistory.length >= 1) {
      const first = uniqueShopHistory[0];
      const last = uniqueShopHistory[uniqueShopHistory.length - 1];
      const growth = last.sold - first.sold;
      
      let growthRate = 'N/A';
      if (uniqueShopHistory.length >= 2 && first.sold > 0) {
        growthRate = ((growth / first.sold) * 100).toFixed(1) + '%';
      } else if (uniqueShopHistory.length === 1) {
        growthRate = 'Chưa đủ dữ liệu';
      }
      
      shopGrowth = {
        shopName: shopName || shopId,
        firstCrawl: { date: first.date, sold: first.sold },
        lastCrawl: { date: last.date, sold: last.sold },
        totalGrowth: growth,
        growthRate: growthRate,
        dataPoints: uniqueShopHistory.length
      };
    }

    // Create prompt for DeepSeek
    const hasMultipleDataPoints = shopGrowth && shopGrowth.dataPoints >= 2;
    const productsWithGrowth = productSummaries.filter(p => p.dataPoints >= 2);
    
    const prompt = `Bạn là chuyên gia phân tích dữ liệu TikTok Shop. ${hasMultipleDataPoints ? 'Phân tích dữ liệu sau và đưa ra nhận xét chi tiết' : 'Đây là lần crawl đầu tiên, hãy đánh giá hiện trạng và đưa ra khuyến nghị'}:

THÔNG TIN SHOP:
${shopGrowth ? `
- Tên shop: ${shopGrowth.shopName}
- Lần crawl đầu: ${new Date(shopGrowth.firstCrawl.date).toLocaleString('vi-VN')} - Đã bán: ${shopGrowth.firstCrawl.sold.toLocaleString()}
${shopGrowth.dataPoints >= 2 ? `- Lần crawl mới nhất: ${new Date(shopGrowth.lastCrawl.date).toLocaleString('vi-VN')} - Đã bán: ${shopGrowth.lastCrawl.sold.toLocaleString()}
- Tăng trưởng: ${shopGrowth.totalGrowth >= 0 ? '+' : ''}${shopGrowth.totalGrowth.toLocaleString()} sản phẩm (${shopGrowth.growthRate})` : `- Trạng thái: Đang theo dõi, chưa có dữ liệu tăng trưởng`}
- Số lần theo dõi: ${shopGrowth.dataPoints}
` : 'Không đủ dữ liệu shop'}

${productsWithGrowth.length > 0 ? `TOP SẢN PHẨM TĂNG TRƯỞNG MẠNH (${productsWithGrowth.length} sản phẩm có data):` : `DANH SÁCH SẢN PHẨM (${productSummaries.length} sản phẩm):`}
${productSummaries
  .sort((a, b) => b.totalGrowth - a.totalGrowth)
  .slice(0, 10)
  .map((p, i) => `
${i + 1}. ${p.name}
   - Lần đầu: ${new Date(p.firstCrawl.date).toLocaleDateString('vi-VN')} - ${p.firstCrawl.sold.toLocaleString()} đã bán
   ${p.dataPoints >= 2 ? `- Lần cuối: ${new Date(p.lastCrawl.date).toLocaleDateString('vi-VN')} - ${p.lastCrawl.sold.toLocaleString()} đã bán
   - Tăng trưởng: ${p.totalGrowth >= 0 ? '+' : ''}${p.totalGrowth.toLocaleString()} (${p.growthRate})` : `- Trạng thái: Đang theo dõi`}
`)
  .join('\n')}

YÊU CẦU PHÂN TÍCH:
${hasMultipleDataPoints ? `
1. Đánh giá xu hướng tăng trưởng của shop qua ${shopGrowth.dataPoints} lần theo dõi
2. Xác định sản phẩm có tiềm năng cao nhất (tốc độ tăng trưởng)
3. Khuyến nghị chiến lược để tối ưu doanh số
4. Phân tích điểm mạnh và cơ hội cải thiện` : `
1. Đánh giá hiện trạng shop dựa trên dữ liệu hiện tại
2. Nhận xét về danh mục sản phẩm và số lượng đã bán
3. Đề xuất chiến lược để theo dõi và tối ưu trong tương lai
4. Khuyến nghị crawl thêm để có dữ liệu phân tích tăng trưởng`}

QUAN TRỌNG: Trả lời bằng văn bản thuần (plain text), KHÔNG dùng markdown, KHÔNG dùng ký hiệu đặc biệt như thăng (#), sao (*), hoặc bất kỳ format đánh dấu nào. Viết bằng tiếng Việt, ngắn gọn (300-500 từ), chia thành các đoạn văn rõ ràng.`;

    console.log('🤖 Calling DeepSeek AI...');
    console.log(`🤖 [Step 4] Prompt length: ${prompt.length} chars`);
    console.log(`🤖 [Step 5] Product summaries count: ${productSummaries.length}`);

    // Call DeepSeek API
    const aiResponse = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Bạn là chuyên gia phân tích dữ liệu thương mại điện tử, chuyên về TikTok Shop. Phân tích dữ liệu một cách chuyên nghiệp, ngắn gọn và đưa ra insight có giá trị.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ [Step 6] DeepSeek API response received');
    const analysis = aiResponse.data.choices[0].message.content;
    console.log(`✅ [Step 7] Analysis length: ${analysis.length} chars`);

    return res.json({
      success: true,
      shopInfo: shopGrowth,
      topProducts: productSummaries.sort((a, b) => b.totalGrowth - a.totalGrowth).slice(0, 10),
      aiAnalysis: analysis,
      dataPoints: {
        totalProducts: Object.keys(productAnalysis).length,
        productsWithGrowth: productSummaries.length,
        shopDataPoints: shopSoldHistory.length
      }
    });

  } catch (error) {
    console.error('❌ [ERROR] Error analyzing growth:', error.message);
    console.error('❌ [ERROR] Stack:', error.stack);
    
    if (error.response) {
      console.error('❌ [ERROR] DeepSeek API Response Status:', error.response.status);
      console.error('❌ [ERROR] DeepSeek API Response Data:', JSON.stringify(error.response.data));
      return res.status(error.response.status).json({
        error: `DeepSeek API Error: ${error.response.data?.error?.message || error.message}`,
        details: error.response.data
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ 
        error: 'Request timeout - DeepSeek API took too long to respond',
        hint: 'Try again or check your internet connection'
      });
    }
    
    return res.status(500).json({ 
      error: error.message,
      hint: 'Check server logs for details. Verify DeepSeek API key is valid.'
    });
  }
});

// Crawl endpoint
app.post('/api/crawl', async (req, res) => {
  const { links, apiKey, note, prefs } = req.body;
  if (!Array.isArray(links)) return res.status(400).json({ error: 'links must be an array' });
  
  // Sequential crawling only - no concurrency
  console.log(`📊 Processing ${links.length} links sequentially (one at a time)`);

  const results = [];

  // Preferences for locale/region
  const basePrefs = prefs || { lang: 'en-US', timezone: 'America/New_York', geolocation: { latitude: 40.7128, longitude: -74.0060, accuracy: 100 } };
  const langPref = (basePrefs && typeof basePrefs.lang === 'string' && basePrefs.lang.trim()) ? basePrefs.lang.trim() : 'en-US';
  const timezonePref = (basePrefs && typeof basePrefs.timezone === 'string' && basePrefs.timezone.trim()) ? basePrefs.timezone.trim() : 'America/New_York';
  const geolocationPref = (basePrefs && typeof basePrefs.geolocation === 'object' && basePrefs.geolocation)
    ? { latitude: Number(basePrefs.geolocation.latitude) || 40.7128, longitude: Number(basePrefs.geolocation.longitude) || -74.0060, accuracy: Number(basePrefs.geolocation.accuracy) || 100 }
    : { latitude: 40.7128, longitude: -74.0060, accuracy: 100 };

  // 🔥 Create a single browser instance for this entire crawl session
  let sessionBrowser = null;
  let browserWasCreated = false;
  
  try {
    // Use shared browser if available, otherwise create a new one for this session
    if (sharedBrowser) {
      console.log('✓ Using existing shared browser (with login + extensions)');
      sessionBrowser = sharedBrowser;
    } else {
      console.log('🌐 Creating new browser instance for this crawl session...');
      const launchOptions = createLaunchOptions(true); // Use persistent userDataDir
      launchOptions.headless = false; // Keep browser visible
      launchOptions.defaultViewport = null;
      
      // Add additional args for locale/lang
      launchOptions.args.push(
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--ignore-certificate-errors-spki-list',
        '--disable-software-rasterizer',
        '--disable-extensions',
        `--lang=${langPref}`
      );
      
      sessionBrowser = await puppeteer.launch(launchOptions);
      browserWasCreated = true;
      console.log('✅ Browser opened successfully! Browser will remain open after crawling completes.');
      console.log('💡 You can close the browser manually when done.');
    }
  } catch (error) {
    console.error('❌ Failed to create browser:', error.message);
    return res.status(500).json({ error: 'Failed to create browser: ' + error.message });
  }

  // Worker function to crawl a single URL (mostly existing logic)
  const crawlUrl = async (url) => {
    try {
      console.log('---\nCrawling:', url);
      // Random delay giữa các request (1-3s)
      await randomDelay(1000, 3000);
      
      // Puppeteer crawl
      let html = '';
      let shopName = '', shopSold = '', productName = '', productSold = '';
      try {
        // Resolve short URLs ahead of time to reduce redirects/timeouts
        const targetUrl = await resolveShortUrl(url);
        if (targetUrl !== url) {
          console.log('  → Resolved short URL to:', targetUrl);
        }
        
        // 🔥 Use the session browser (always available in this new design)
        const page = await sessionBrowser.newPage();
        console.log('✓ Opened new tab in session browser');
        
        // Emulate timezone + grant geo permission + set geolocation
        try {
          const context = sessionBrowser.defaultBrowserContext();
          await context.overridePermissions('https://www.tiktok.com', ['geolocation']);
          await context.overridePermissions('https://vm.tiktok.com', ['geolocation']);
          await page.emulateTimezone(timezonePref);
          await page.setGeolocation(geolocationPref);
        } catch (e) {
          console.log('Geo/Timezone emulate warning:', e.message);
        }
        // Tighten resource loading to speed up nav
        try {
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const type = req.resourceType();
            // Do NOT block images/styles/websockets — needed for CAPTCHA/UI rendering
            // Keep blocking heavy/less critical types for speed
            if (['media','font','manifest'].includes(type)) {
              return req.abort();
            }
            return req.continue();
          });
        } catch { /* ignore */ }
        
        // Set viewport như browser thật
        await page.setViewport({ width: 1920, height: 1080 });
        page.setDefaultNavigationTimeout(45000);
        page.setDefaultTimeout(30000);
        
        // Set User Agent giống browser thật (US user)
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );
        
        // Set extra headers để giống US user thật
        await page.setExtraHTTPHeaders({
          'Accept-Language': `${langPref},${langPref.split('-')[0]};q=0.9`,  // ưu tiên ngôn ngữ chính
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"'
        });
        
        // 🎯 API INTERCEPTION - Primary data extraction method
  let apiData = null; // Product detail API payload (preferred)
  let apiRequestsCount = 0;
        
        console.log('🎯 Setting up API interception...');
        
        await page.on('response', async (response) => {
          const url = response.url();
          const status = response.status();
          
          // Only process successful JSON responses
          if (status !== 200) return;
          
          const contentType = response.headers()['content-type'] || '';
          if (!contentType.includes('json')) return;
          
          try {
            const data = await response.json();
            
            // TikTok Shop API patterns
            const isShopAPI = url.includes('/api/shop/');
            const isSuggestWords = /get_suggest_words/i.test(url);
            const isProductDetail = /pdp_desktop\/page_data|\/product\/detail|ProductDetail/i.test(url);
            const isProductShaped = (obj) => {
              try {
                if (!obj || typeof obj !== 'object') return false;
                const d = obj.data;
                if (!d || typeof d !== 'object') return false;
                return Boolean(
                  d.global_data?.product_info ||
                  d.product || d.productDetail || d.productInfo || d.item
                );
              } catch { return false; }
            };
            
            if (isShopAPI) {
              console.log('✓ Intercepted TikTok Shop API:', url.substring(0, 120));
              console.log('  Status:', data.status_code || data.code || 'unknown');
              console.log('  Data keys:', Object.keys(data || {}).join(', '));
              
              // Only treat product detail endpoints as primary apiData
              if (!apiData && isProductDetail && isProductShaped(data)) {
                apiData = data;
                console.log('  → Captured PRODUCT API data!');
              }
              
              apiRequestsCount++;
            }
          } catch (e) {
            // Ignore parse errors
          }
        });
        
  // Set user agent như browser thật
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        
        // ✅ ENHANCED: Anti-detection fingerprinting with advanced techniques
        await page.evaluateOnNewDocument((lang) => {
          // Hide automation
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          delete Object.getPrototypeOf(navigator).webdriver;
          
          // US browser fingerprint
          try {
            Object.defineProperty(navigator, 'languages', { get: () => [lang, lang.split('-')[0]] });
            Object.defineProperty(navigator, 'language', { get: () => lang });
          } catch {}
          
          // Real browser plugins
          Object.defineProperty(navigator, 'plugins', { 
            get: () => [
              { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              { name: 'Chromium PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' }
            ]
          });
          
          // Hardware concurrency
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
          
          // Device memory
          Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
          
          // Chrome object
          window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
          
          // Permissions
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
          
          // ✅ NEW: Canvas fingerprint randomization
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png' && this.width === 280 && this.height === 60) {
              // Likely fingerprinting canvas - add tiny noise
              const context = this.getContext('2d');
              const imageData = context.getImageData(0, 0, this.width, this.height);
              for (let i = 0; i < imageData.data.length; i += 4) {
                imageData.data[i] += Math.floor(Math.random() * 3) - 1;
              }
              context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
          };
          
          // ✅ NEW: WebGL fingerprint (realistic values)
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
            if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
            return getParameter.apply(this, arguments);
          };
          
          // ✅ NEW: Battery API (realistic desktop values)
          Object.defineProperty(navigator, 'getBattery', {
            get: () => () => Promise.resolve({
              charging: true,
              chargingTime: 0,
              dischargingTime: Infinity,
              level: 1
            })
          });
          
          // ✅ NEW: Platform & vendor
          Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
          Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
          
          // ✅ NEW: Screen color depth
          Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
          Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
          
          // Timezone handled by page.emulateTimezone('America/New_York')
        }, langPref);
        
        // Set headers (normalize language)
        await page.setExtraHTTPHeaders({
          'Accept-Language': `${langPref},${langPref.split('-')[0]};q=0.9`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        console.log('Navigating to:', targetUrl);
        
        // Try to navigate with retry logic
        let navigationSuccess = false;
        let retryCount = 0;
        const timeouts = [25000, 35000, 45000];
        const maxRetries = timeouts.length;
        
        while (!navigationSuccess && retryCount < maxRetries) {
          try {
            await page.goto(targetUrl, { 
              waitUntil: 'domcontentloaded', // faster; API interception will still capture JSON
              timeout: timeouts[retryCount] 
            });
            navigationSuccess = true;
            console.log('✓ Navigation successful');
          } catch (navError) {
            retryCount++;
            console.log(`Navigation attempt ${retryCount} failed:`, navError.message);
            
            if (retryCount < maxRetries) {
              console.log(`Retrying in ~2 seconds with higher timeout...`);
              await randomDelay(1500, 2500);
            } else {
              // Last attempt with minimal wait
              try {
                await page.goto(targetUrl, { 
                  waitUntil: 'domcontentloaded',
                  timeout: 45000 
                });
                navigationSuccess = true;
                console.log('✓ Navigation successful (minimal wait)');
              } catch (finalError) {
                throw new Error(`Failed to load page after ${maxRetries} retries: ${finalError.message}`);
              }
            }
          }
        }
        
        // Chờ thêm để API requests hoàn thành
        console.log('Waiting for page to fully load...');
        await randomDelay(1000, 2000);
        
        // ✅ STEP 3: PHÁT HIỆN CAPTCHA
        console.log('🔍 STEP 3: Phát hiện CAPTCHA...');
        const detectedType = await detectCaptchaType(page);
        
        if (detectedType !== 'NONE') {
          console.log(`⏸️  CAPTCHA phát hiện: ${detectedType}`);
          
          // Nếu đang dùng shared browser (có extension), ưu tiên để extension tự giải
          if (browser === sharedBrowser) {
            console.log('🤖 Shared browser detected - Chờ CAPTCHA được giải (extension hoặc manual)...');
            console.log('⏳ Waiting up to 5 minutes for CAPTCHA to be solved...');
            console.log('💡 TIP: Nếu extension không tự giải, bạn có thể giải tay trong browser window!');
            
            // Poll để kiểm tra HTML size tăng lên (nghĩa là đã vượt qua CAPTCHA)
            const maxWaitTime = 300000; // 5 phút (300 giây) - đủ thời gian giải tay
            const pollInterval = 5000; // Check mỗi 5 giây
            const startWait = Date.now();
            let captchaSolved = false;
            
            while (Date.now() - startWait < maxWaitTime) {
              await randomDelay(pollInterval, pollInterval + 1000);
              
              // Kiểm tra HTML size
              const htmlCheck = await page.evaluate(() => {
                const html = document.documentElement.outerHTML;
                return {
                  size: html.length,
                  hasCaptcha: /captcha|verify|slide/i.test(html)
                };
              });
              
              console.log(`  📏 HTML size: ${htmlCheck.size} bytes, has CAPTCHA keywords: ${htmlCheck.hasCaptcha}`);
              
              // Nếu HTML > 30KB và không còn CAPTCHA keywords = thành công
              if (htmlCheck.size > 30000 && !htmlCheck.hasCaptcha) {
                console.log('✅ Extension đã giải CAPTCHA thành công! Page loaded.');
                captchaSolved = true;
                break;
              }
              
              const elapsed = ((Date.now() - startWait) / 1000).toFixed(1);
              console.log(`  ⏱️  Elapsed: ${elapsed}s / 300s (5 minutes)`);
            }
            
            if (!captchaSolved) {
              console.log('⚠️  CAPTCHA chưa được giải sau 5 phút');
              console.log('💡 Check: Extension có bật không? Hoặc bạn đã giải tay đúng chưa?');
              // Vẫn tiếp tục thử crawl, có thể đã giải nhưng ta chưa phát hiện
            } else {
              // Chờ thêm để data load đầy đủ
              console.log('⏳ Waiting for data to fully load...');
              await randomDelay(3000, 5000);
            }
          } else {
            // Không có extension, dùng API key
            if (!apiKey) {
              console.log('❌ Không có API key - không thể giải CAPTCHA');
              results.push({
                url,
                status: 'captcha_detected',
                reason: 'captcha',
                message: 'CAPTCHA detected but no API key provided. Please add hmcaptcha API key.',
                suggestion: 'Thêm API Key hmcaptcha.com hoặc giảm tốc độ/concurrency để giảm CAPTCHA.'
              });
              // Close only the tab, keep session browser open
              await page.close();
              console.log('✓ Tab closed (CAPTCHA no API), browser stays open');
              return;
            }
            
            // ✅ STEP 4: GIẢI CAPTCHA với API
            console.log('🤖 STEP 4: Bắt đầu giải CAPTCHA với hmcaptcha API...');
            const captchaSolved = await solveCaptchaIfNeeded(page, apiKey);
            
            if (!captchaSolved.success) {
              console.log('❌ CAPTCHA KHÔNG GIẢI ĐƯỢC! Lỗi:', captchaSolved.error);
              results.push({
                url,
                status: 'captcha_failed',
                reason: 'captcha',
                message: 'CAPTCHA detected, solver failed: ' + (captchaSolved.error || 'Unknown error'),
                suggestion: 'Cài extension CAPTCHA solver trong shared browser, giảm concurrency, hoặc kiểm tra API key.'
              });
              // Close only the tab, keep session browser open
              await page.close();
              console.log('✓ Tab closed (CAPTCHA failed), browser stays open');
              return;
            }
            
            console.log('✅ CAPTCHA ĐÃ GIẢI XONG! Chờ page reload và data load...');
            await randomDelay(5000, 8000);
            
            // Chờ thêm cho API requests hoàn thành
            console.log('⏳ Waiting for product data to load...');
            await page.waitForTimeout(3000);
          }
        } else {
          console.log('✅ No CAPTCHA detected - proceeding...');
        }
        
        // Kiểm tra xem có thực sự vượt qua gate không (nếu có CAPTCHA được giải)
        if (detectedType !== 'NONE') {
          console.log('🔍 Xác nhận đã vượt qua CAPTCHA...');
          const stillGated = await page.evaluate(() => {
            const html = document.documentElement.outerHTML;
            const text = document.body.innerText.toLowerCase();
            const isSmallHtml = html.length < 30000;
            const hasGateKeywords = /captcha|verify|not available|region|access denied|please try again|slide to verify/i.test(text);
            return { isSmallHtml, hasGateKeywords, htmlSize: html.length };
          });
          
          if (stillGated.isSmallHtml || stillGated.hasGateKeywords) {
            console.log(`⚠️  HTML vẫn nhỏ (${stillGated.htmlSize}B), thử reload page một lần...`);
            
            // Thử reload page một lần nếu extension có thể đã giải nhưng page chưa reload
            try {
              await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
              console.log('✓ Page reloaded, waiting for content...');
              await randomDelay(5000, 8000);
              
              // Kiểm tra lại
              const recheckGated = await page.evaluate(() => {
                const html = document.documentElement.outerHTML;
                return {
                  htmlSize: html.length,
                  isSmall: html.length < 30000
                };
              });
              
              if (recheckGated.isSmall) {
                console.log(`❌ Vẫn bị chặn sau reload! HTML size: ${recheckGated.htmlSize}`);
                results.push({
                  url,
                  status: 'gate_stuck',
                  reason: 'gate',
                  message: `Still stuck at verification page after reload. HTML size: ${recheckGated.htmlSize}`,
                  suggestion: 'Extension không giải được CAPTCHA. Thử: 1) Check extension hoạt động, 2) VPN đổi IP, 3) Giảm concurrency = 1'
                });
                // Close only the tab, keep session browser open
                await page.close();
                console.log('✓ Tab closed (gate stuck), browser stays open');
                return;
              } else {
                console.log(`✅ Reload thành công! HTML size: ${recheckGated.htmlSize}`);
              }
            } catch (reloadError) {
              console.log('❌ Reload failed:', reloadError.message);
              results.push({
                url,
                status: 'gate_stuck',
                reason: 'gate',
                message: `Cannot reload page: ${reloadError.message}`,
                suggestion: 'Extension không giải được CAPTCHA hoặc IP bị chặn. Check extension hoạt động.'
              });
              // Close only the tab, keep session browser open
              await page.close();
              console.log('✓ Tab closed (reload failed), browser stays open');
              return;
            }
          } else {
            console.log('✅ Đã vượt qua CAPTCHA thành công! HTML size:', stillGated.htmlSize);
          }
        }
        
        // ✅ STEP 5: TIẾP TỤC CRAWL DỮ LIỆU
        console.log('Waiting for API requests...');
        await randomDelay(1500, 3000);
        
        // Thử click/interact để trigger API nếu cần
        try {
          await page.evaluate(() => {
            // Trigger events có thể gọi API
            window.dispatchEvent(new Event('scroll'));
            window.dispatchEvent(new Event('resize'));
          });
          await randomDelay(2000, 3000); // Chờ thêm 2-3s
        } catch (e) {
          console.log('Interaction warning:', e.message);
        }
        
        // Chờ selector xuất hiện (tối đa 45s để extension có thời gian giải CAPTCHA)
        let foundSelectors = false;
        try {
          console.log('⏳ Waiting for page elements (timeout: 45s for CAPTCHA extension)...');
          // Use fallback selectors with long timeout for extension to solve CAPTCHA
          const titleEl = await waitForAnySelector(page, [
            '[data-e2e="product-title"]',
            'h1[role="heading"]',
            'h1[class*="title"]',
            'span[class*="Semibold"]',
            'h1'
          ], 45000); // Tăng lên 45s cho extension CAPTCHA
          if (!titleEl) throw new Error('title selector not found');
          console.log('✓ Found selectors on page');
          foundSelectors = true;
        } catch (e) {
          console.log('⚠ Timeout waiting for selectors after 45s:', e.message);
          
          // Nếu không tìm thấy selector, kiểm tra xem có phải đang ở gate/verify không
          const gateCheck = await page.evaluate(() => {
            const html = document.documentElement.outerHTML;
            const text = document.body.innerText.toLowerCase();
            return {
              htmlSize: html.length,
              isSmall: html.length < 30000,
              hasGate: /captcha|verify|not available|access denied|please try again/i.test(text)
            };
          });
          
          if (gateCheck.isSmall || gateCheck.hasGate) {
            console.log(`❌ Selector timeout + gate detected. HTML: ${gateCheck.htmlSize}B, gate keywords: ${gateCheck.hasGate}`);
            // Attempt CAPTCHA solve at this late stage if API key is available
            if (apiKey) {
              console.log('🔧 Late-stage CAPTCHA attempt after gate detection...');
              const lateType = await detectCaptchaType(page);
              if (lateType !== 'NONE') {
                const solved = await solveCaptchaIfNeeded(page, apiKey);
                if (solved.success) {
                  console.log('✅ Late-stage CAPTCHA solved. Continuing...');
                  await randomDelay(2500, 4000);
                } else {
                  console.log('❌ CAPTCHA NOT solved at late stage:', solved.error);
                  results.push({
                    url,
                    status: 'captcha_failed',
                    reason: 'captcha',
                    message: 'CAPTCHA detected late (after selector timeout) and solver failed: ' + (solved.error || 'Unknown'),
                    suggestion: 'Cài extension CAPTCHA solver, giảm concurrency, kiểm tra API key và thử lại.'
                  });
                  // Close only the tab, keep session browser open
                  await page.close();
                  console.log('✓ Tab closed (late CAPTCHA failed), browser stays open');
                  return;
                }
              } else {
                console.log('ℹ Gate detected but no explicit CAPTCHA type recognized. Treat as gate.');
                results.push({
                  url,
                  status: 'gate_detected',
                  reason: 'gate',
                  message: `Page stuck at gate/verify. HTML size: ${gateCheck.htmlSize}B`,
                  suggestion: 'IP bị TikTok chặn. Dùng VPN extension, giảm concurrency xuống 1, hoặc thử region khác.'
                });
                // Close only the tab, keep session browser open
                await page.close();
                console.log('✓ Tab closed (gate detected), browser stays open');
                return;
              }
            } else {
              results.push({
                url,
                status: 'gate_detected',
                reason: 'gate',
                message: `Page stuck at gate/verify. HTML size: ${gateCheck.htmlSize}B`,
                suggestion: 'Cần thêm API Key hmcaptcha để thử solve. Ngoài ra, dùng VPN extension/giảm concurrency.'
              });
              // Close only the tab, keep session browser open
              await page.close();
              console.log('✓ Tab closed (gate no API), browser stays open');
              return;
            }
          }
          console.log('⚠ Selector timeout but HTML looks normal (size: ' + gateCheck.htmlSize + 'B), continuing...');
        }
        
        // Scroll để trigger lazy loading
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await randomDelay(1000, 2000);
        
        console.log(`Total API requests detected: ${apiRequestsCount}`);
        console.log(`API data captured: ${apiData ? 'YES' : 'NO'}`);
        
        // Lấy dữ liệu với nhiều selector khác nhau
        const data = await page.evaluate(() => {
          // PRIORITY 1: Thử lấy data từ __MODERN_ROUTER_DATA__ JSON (TikTok Shop dùng React + JSON)
          try {
            const scriptEl = document.querySelector('script#__MODERN_ROUTER_DATA__');
            if (scriptEl) {
              const jsonData = JSON.parse(scriptEl.textContent);
              const loaderData = jsonData?.loaderData?.['view/product/(product_id)/page'];
              
              // Lấy product info
              const productInfo = loaderData?.page_config?.global_data?.product_info?.product_info;
              
              // Lấy shop info từ components_map
              const shopInfoComponent = loaderData?.page_config?.components_map?.find(
                c => c.component_type === 'shop_info'
              );
              const shopData = shopInfoComponent?.component_data;
              
              // Lấy product info từ product_info component
              const productInfoComponent = loaderData?.page_config?.components_map?.find(
                c => c.component_type === 'product_info'
              );
              const productData = productInfoComponent?.component_data;
              
              // Thử lấy product name từ title tag nếu không có trong JSON
              let productName = productInfo?.title || productInfo?.product_name || productData?.title || '';
              if (!productName) {
                const titleTag = document.querySelector('title');
                if (titleTag) {
                  productName = titleTag.textContent.replace(/ - TikTok Shop/g, '').trim();
                }
              }
              
              // Nếu có ít nhất 1 field, return data từ JSON
              const shopName = shopData?.shop_name || '';
              const shopSold = shopData?.total_sold || shopData?.sold_count || '';
              const productSold = productInfo?.sold_count || productInfo?.sales || productData?.sold_count || '';
              
              if (shopName || shopSold || productName || productSold) {
                return {
                  shopName,
                  shopSold,
                  productName,
                  productSold,
                  fromJSON: true
                };
              }
            }
          } catch (e) {
            console.log('Failed to parse JSON data:', e.message);
          }
          
          // PRIORITY 2: Extract từ DOM HTML
          const getText = (selectors) => {
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return '';
          };
          
          // Lấy shop sold - tìm text "Món bán ra" rồi lấy số ở phần trước
          const getShopSold = () => {
            // Tìm tất cả span có text "Món bán ra"
            const allSpans = Array.from(document.querySelectorAll('span'));
            const targetSpan = allSpans.find(span => 
              span.textContent.includes('Món bán ra') || 
              span.textContent.includes('món bán ra')
            );
            
            if (targetSpan) {
              // Lấy parent div, tìm span.H4-Semibold ở trước nó
              const parentDiv = targetSpan.closest('div');
              if (parentDiv) {
                const numberSpan = parentDiv.querySelector('span.H4-Semibold.text-color-UIText1');
                if (numberSpan) return numberSpan.textContent.trim();
              }
            }
            
            // Fallback: tìm trực tiếp span.H4-Semibold kế bên span có text "Món bán ra"
            const headlineSpans = Array.from(document.querySelectorAll('span.Headline-Regular'));
            for (const span of headlineSpans) {
              if (span.textContent.includes('Món bán ra')) {
                const prevSibling = span.previousElementSibling;
                if (prevSibling && prevSibling.classList.contains('H4-Semibold')) {
                  return prevSibling.textContent.trim();
                }
              }
            }
            
            return '';
          };
          
          // Lấy product sold - tìm text "bán" trong product
          const getProductSold = () => {
            const selectors = [
              'span.H3-Regular.text-color-UIText2',
              'span[class*="H3-Regular"]',
              'span[class*="text-color-UIText2"]'
            ];
            for (const selector of selectors) {
              const elements = Array.from(document.querySelectorAll(selector));
              const soldEl = elements.find(e => e.textContent.includes('bán') || e.textContent.includes('sold'));
              if (soldEl) return soldEl.textContent.trim();
            }
            return '';
          };
          
          return {
            shopName: getText([
              'span.H2-Semibold.text-color-UIText1',
              'span[class*="H2-Semibold"][class*="text-color-UIText1"]',
              'a[class*="shop-name"] span',
              'div[class*="shop-info"] span[class*="Semibold"]'
            ]),
            shopSold: getShopSold(),
            productName: getText([
              'h1 span.H2-Semibold.text-color-UIText1Display',
              'h1 span[class*="H2-Semibold"]',
              'h1[class*="product-title"]',
              'div[class*="product-name"] h1'
            ]),
            productSold: getProductSold(),
            fromJSON: false
          };
        });
        
        // 🎯 PRIORITY 0: Parse intercepted API data (Primary method)
        if (apiData) {
          console.log('\n✓ Using intercepted TikTok API data');
          
          // Check for TikTok error codes
          const errorCode = 
            apiData.data?.global_data?.product_info?.error_code ||
            apiData.data?.error_code ||
            apiData.error_code;
          
          if (errorCode === 23002102) {
            console.log('⚠️ TikTok Error Code 23002102: PRODUCT NOT AVAILABLE IN REGION');
            console.log('   This product is geo-restricted.');
            console.log('   Proxy region:', proxy ? 'US' : 'None');
            console.log('   Suggestions:');
            console.log('   1. Use a Vietnam TikTok link (vt.tiktok.com)');
            console.log('   2. Use a US Residential proxy (not datacenter)');
            console.log('   3. Try different proxy session');
          }
          
          // Log full response for debugging
          console.log('\n=== API Response Structure (first 3000 chars) ===');
          console.log(JSON.stringify(apiData, null, 2).substring(0, 3000));
          
          // TikTok API structure: { code, message, data: { product: {...}, author: {...} } }
          const responseData = apiData.data || {};
          
          // Extract product object
          const product = 
            responseData.product || 
            responseData.productDetail || 
            responseData.productInfo ||
            responseData.item ||
            {};
          
          // Extract author/shop object (can be in product or at top level)
          const author = 
            product.author ||
            product.shop ||
            product.seller ||
            responseData.author ||
            responseData.shop ||
            {};
          
          console.log('\n=== Extracted Objects ===');
          if (Object.keys(product).length > 0) {
            console.log('Product object found with keys:', Object.keys(product).slice(0, 20).join(', '));
          } else {
            console.log('⚠ Product object is empty (likely geo-blocked)');
          }
          
          if (Object.keys(author).length > 0) {
            console.log('Author object found with keys:', Object.keys(author).slice(0, 20).join(', '));
          } else {
            console.log('⚠ Author object is empty (likely geo-blocked)');
          }
          
          // Extract product fields
          productName = 
            product.title || 
            product.product_name || 
            product.name ||
            product.productName ||
            '';
          
          productSold = 
            product.sold_count || 
            product.sales || 
            product.total_sold ||
            product.sales_count ||
            '';
          
          // Extract shop/author fields
          shopName = 
            author.unique_id ||
            author.nickname ||
            author.author_name ||
            author.shop_name ||
            author.name ||
            author.username ||
            '';
          
          shopSold = 
            author.product_count ||
            author.sold_count || 
            author.total_sold ||
            author.total_products ||
            '';

          // Capture stable shop identifiers if present
          var _extractedShopId = author.shop_id || author.sec_uid || author.uid || author.id || null;
          var _extractedShopSlug = author.unique_id || author.username || author.shop_name || null;
          
          console.log('\n=== Extracted Values ===');
          console.log('Product Name:', productName || '(empty)');
          console.log('Product Sold:', productSold || '(empty)');
          console.log('Shop Name:', shopName || '(empty)');
          console.log('Shop Sold:', shopSold || '(empty)');
          
          // If still empty and error code present, set error message
          if (!productName && !productSold && !shopName && !shopSold && errorCode === 23002102) {
            productName = 'N/A (Geo-blocked - Error 23002102)';
            console.log('\n⚠️ Setting error message in productName field');
          }
        }
        
        html = await page.content();
        
        // Lưu screenshot để debug và OCR
        const screenshotPath = 'debug/screenshot_debug.png';
        try {
          await page.screenshot({ path: screenshotPath, fullPage: false });
          console.log('✓ Screenshot saved');
        } catch (e) {
          console.log('Screenshot error:', e.message);
        }
        
        // PRIORITY -1: Advanced DOM extraction nếu chưa có data ⭐
        if (!shopName || !shopSold || !productSold) {
          console.log('🔍 Trying advanced DOM extraction as final attempt...');
          
          const advancedData = await advancedDOMExtraction(page);
          
          if (advancedData) {
            // Merge với existing data (giữ data có sẵn, chỉ fill thiếu)
            shopName = shopName || advancedData.shopName;
            shopSold = shopSold || advancedData.shopSold;
            productName = productName || advancedData.productName;
            productSold = productSold || advancedData.productSold;
            
            console.log('✓ Advanced DOM extraction completed');
            console.log({shopName, shopSold, productName, productSold});
          }
        }
        
        // ✅ Always close only the tab, never close the session browser
        await page.close();
        console.log('✓ Tab closed, browser stays open for next URL');
        
      } catch (err) {
        // ✅ Close tab on error, browser stays open
        try { 
          if (page) await page.close(); 
          console.log('✓ Tab closed (error), browser stays open');
        } catch {}
        
        console.error('Puppeteer error:', err.message);
        throw new Error('Puppeteer crawl error: ' + err.message);
      }
      
      console.log('Fetched HTML, length:', html.length);
      
      // ⚠️ Final gate check: HTML quá nhỏ = chưa vào được PDP thật
      if (html.length < 30000) {
        console.log('❌ HTML too small (' + html.length + 'B) - likely still at gate/verify page');
        results.push({
          url,
          status: 'gate_html_small',
          reason: 'gate',
          message: `HTML too small (${html.length}B), likely stuck at verification/gate page`,
          suggestion: 'IP bị chặn hoàn toàn. Dùng VPN extension với IP sạch, giảm concurrency = 1, thử lại sau vài phút.'
        });
        try { upsertHistoryItem({ url, shopName: 'Gate/Verify', shopSold: 'N/A', productName: 'Cannot access', productSold: 'N/A', note }); } catch {}
        return;
      }
      
      // Lưu HTML để debug
      try {
        fs.writeFileSync('debug/html_log.txt', html, { encoding: 'utf8' });
        console.log('✓ HTML saved to debug/html_log.txt');
      } catch (err) {
        console.log('⚠ Error saving html_log.txt:', err.message);
      }
      
      // Check nếu có geo-restriction error
      const isGeoBlocked = html.includes('not available in this country or region') || 
                          html.includes('not for sale in the region') ||
                          html.includes('Product not available');
      
      if (isGeoBlocked) {
        console.log('⚠ Product is geo-restricted (not available in this region)');
        console.log('💡 Solution: This product is region-locked. Shop/sold data is not available.');
        console.log('   → Use a link from Vietnam TikTok (vt.tiktok.com) for full data');
        console.log('   → Or use a high-quality residential proxy for the correct region');
        
        // Vẫn trả về result nhưng với warning
        const item = {
          url,
          status: 'geo_restricted',
          reason: 'geo',
          shopId: (typeof _extractedShopId !== 'undefined') ? _extractedShopId : null,
          shopSlug: (typeof _extractedShopSlug !== 'undefined') ? _extractedShopSlug : null,
          shopName: shopName || 'N/A (Geo-blocked)',
          shopSold: shopSold || 'N/A (Geo-blocked)',
          productName: productName || 'Unknown',
          productSold: productSold || 'N/A (Geo-blocked)',
          message: 'Product is region-locked. Use Vietnam TikTok link or VPN extension for correct region.',
          suggestion: 'Dùng VPN extension với region đúng, hoặc link vt.tiktok.com nội địa.'
        };
        results.push(item);
        try { upsertHistoryItem({ url, shopName: item.shopName, shopSold: item.shopSold, productName: item.productName, productSold: item.productSold, note, shopId: item.shopId, shopSlug: item.shopSlug }); } catch {}
        return; // finish this URL
      }
      
      // Kiểm tra xem có dữ liệu không (non geo-blocked case)
      if (shopName || shopSold || productName || productSold) {
        console.log('✓ Successfully extracted data:', { shopName, shopSold, productName, productSold });
        
        // Tính product growth từ history
        let productGrowth = null;
        try {
          const historyItems = readHistory();
          const prevItem = historyItems.find(it => normalizeUrl(it.url) === normalizeUrl(url));
          if (prevItem && prevItem.productSold) {
            const previousProductSold = parseSold(prevItem.productSold);
            const currentProductSold = parseSold(productSold);
            if (previousProductSold !== null && currentProductSold !== null) {
              const diff = currentProductSold - previousProductSold;
              const percent = previousProductSold > 0 ? parseFloat(((diff / previousProductSold) * 100).toFixed(1)) : 0;
              productGrowth = { previous: previousProductSold, current: currentProductSold, diff, percent };
            }
          }
        } catch {}
        
        const item = {
          url,
          status: 'success',
          reason: 'ok',
          shopId: _extractedShopId || null,
          shopSlug: _extractedShopSlug || null,
          shopName,
          shopSold,
          productName,
          productSold
        };
        results.push(item);
        try { upsertHistoryItem({ url, shopName, shopSold, productName, productSold, note, shopId: item.shopId, shopSlug: item.shopSlug, productGrowth }); } catch {}
        return;
      }
      
      // Nếu không có dữ liệu → Fallback cheerio để thử lần cuối
      console.log('⚠ No data extracted - trying cheerio fallback...');
      
      const $ = cheerio.load(html);
      
      // Thử crawl bằng cheerio với selector linh hoạt hơn
      const cheerioShopName = $('span.H2-Semibold.text-color-UIText1, span[class*="H2-Semibold"], a[class*="shop-name"] span').first().text().trim();
      
      // Tìm shopSold - lấy số từ phần "Món bán ra"
      let cheerioShopSold = '';
      $('span').each((i, el) => {
        const text = $(el).text();
        if (text.includes('Món bán ra') || text.includes('món bán ra')) {
          const parent = $(el).parent();
          const numberSpan = parent.find('span.H4-Semibold.text-color-UIText1');
          if (numberSpan.length > 0) {
            cheerioShopSold = numberSpan.text().trim();
            return false; // Break loop
          }
        }
      });
      
      const cheerioProductName = $('h1 span.H2-Semibold.text-color-UIText1Display, h1 span[class*="Semibold"], h1').first().text().trim();
  const cheerioProductSold = $('span.H3-Regular.text-color-UIText2, span[class*="H3-Regular"]').filter((i, el) => $(el).text().includes('bán') || $(el).text().includes('sold')).first().text().trim();
      
      if (cheerioShopName || cheerioShopSold || cheerioProductName || cheerioProductSold) {
        console.log('✓ Extracted via cheerio:', { cheerioShopName, cheerioShopSold, cheerioProductName, cheerioProductSold });
        const item = {
          url,
          status: 'success_cheerio',
          reason: 'ok',
          shopId: (typeof _extractedShopId !== 'undefined') ? _extractedShopId : null,
          shopSlug: (typeof _extractedShopSlug !== 'undefined') ? _extractedShopSlug : null,
          shopName: cheerioShopName,
          shopSold: cheerioShopSold,
          productName: cheerioProductName,
          productSold: cheerioProductSold
        };
        results.push(item);
        try { upsertHistoryItem({ url, shopName: item.shopName, shopSold: item.shopSold, productName: item.productName, productSold: item.productSold, note, shopId: item.shopId, shopSlug: item.shopSlug }); } catch {}
      } else {
        // Thực sự không có gì
        const item = {
          url,
          status: 'no_data',
          reason: 'no_data',
          message: 'Unable to extract data - page may be blocked or CAPTCHA not solved properly',
          suggestion: 'Dùng VPN extension với IP sạch, giảm concurrency, hoặc chạy lại vào thời điểm khác.'
        };
        results.push(item);
      }
      
    } catch (error) {
      console.log('✗ Error crawling', url, ':', error.message);
      const item = { url, status: 'error', reason: 'error', error: error.message, suggestion: 'Kiểm tra VPN extension/API key, thử lại; nếu qua Cloudflare Tunnel hãy bật chế độ chạy nền / async.' };
      results.push(item);
    }
  };

  // Sequential crawling: process one link at a time
  const startTime = Date.now();
  
  console.log(`🔄 Starting sequential crawl of ${links.length} links (one at a time)`);
  
  try {
    for (let i = 0; i < links.length; i++) {
      const url = links[i];
      
      console.log(`\n🔄 Processing link ${i + 1}/${links.length} - ${url.substring(0, 60)}...`);
      await crawlUrl(url);
      
      const completedCount = i + 1;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgTime = (elapsed / completedCount).toFixed(1);
      const remaining = links.length - completedCount;
      const estimatedRemaining = (remaining * avgTime).toFixed(0);
      
      console.log(`✅ Progress: ${completedCount}/${links.length} (${((completedCount/links.length)*100).toFixed(1)}%) | Avg: ${avgTime}s/link | ETA: ~${estimatedRemaining}s`);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter(r => !r.error && r.status !== 'error').length;
    console.log(`🎉 COMPLETED: ${successCount}/${links.length} successful | Total time: ${totalTime}s`);
    
    // 🔥 DO NOT close browser - let user close it manually
    if (browserWasCreated) {
      console.log('');
      console.log('✅ ============================================');
      console.log('✅ CRAWLING COMPLETE!');
      console.log('✅ Browser window is still open for your review');
      console.log('💡 You can close the browser manually when done');
      console.log('✅ ============================================');
      console.log('');
    }
    
    res.json({ 
      results,
      message: browserWasCreated ? 'Crawling complete. Browser window remains open - close it manually when done.' : 'Crawling complete.'
    });
  } catch (error) {
    // Even on error, DO NOT close browser - let user investigate
    console.error('❌ Error during crawl session:', error.message);
    
    if (browserWasCreated) {
      console.log('');
      console.log('⚠️  ============================================');
      console.log('⚠️  CRAWLING INTERRUPTED BY ERROR');
      console.log('⚠️  Browser window is still open for debugging');
      console.log('💡 You can close the browser manually');
      console.log('⚠️  ============================================');
      console.log('');
    }
    
    res.status(500).json({ 
      error: error.message,
      results,
      message: browserWasCreated ? 'Error occurred. Browser window remains open for debugging - close it manually.' : 'Error occurred during crawling.'
    });
  }
});

// Solve captcha endpoint
app.post('/api/solve-captcha', async (req, res) => {
  const { apiKey, type, image, urlImage, urlImage1, urlImage2 } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });
  if (!type) return res.status(400).json({ error: 'type is required' });

  try {
    const payload = { Apikey: apiKey, Type: type };
    if (image) payload.Image = image;
    if (urlImage) payload.URL_Image = urlImage;
    if (urlImage1) payload.URL_Image1 = urlImage1;
    if (urlImage2) payload.URL_Image2 = urlImage2;

    const response = await axios.post('https://hmcaptcha.com/Recognition?wait=1', payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data.Code === 0) {
      // Poll for result if needed, but since wait=1, should be immediate
      res.json({ taskId: response.data.TaskId, status: 'created' });
    } else {
      res.status(400).json({ error: response.data.Message });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get captcha result
app.get('/api/captcha-result', async (req, res) => {
  const { apiKey, taskId } = req.query;
  if (!apiKey || !taskId) return res.status(400).json({ error: 'apiKey and taskId are required' });

  try {
    const response = await axios.get(`https://hmcaptcha.com/getResult?apikey=${apiKey}&taskid=${taskId}`);
    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crawl Shop Only - Get total shop sold and save to history with growth tracking
app.post('/api/crawl-shop-only', async (req, res) => {
  const { url, apiKey, note } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    console.log(`🏪 [Shop Only] Crawling shop sold from: ${url}`);
    
    // Get previous data to calculate growth
    const history = readHistory();
    const nurl = normalizeUrl(url);
    const existing = history.find(it => it.url === nurl);
    const previousShopSold = existing ? parseSold(existing.shopSold) : null;
    
    console.log(`📊 Previous shop sold: ${previousShopSold || 'N/A'}`);
    
    // Call /api/crawl endpoint via HTTP to reuse all crawl logic
    const PORT = process.env.PORT || 8080;
    const crawlResponse = await axios.post(`http://localhost:${PORT}/api/crawl`, {
      links: [url],
      apiKey: apiKey || '',
      note: note || 'Shop crawl',
      concurrency: 1
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000 // 5 minutes
    });
    
    const crawlData = crawlResponse.data;
    
    if (!crawlData || !crawlData.results || crawlData.results.length === 0) {
      throw new Error('No results from crawl');
    }
    
    const result = crawlData.results[0];
    
    if (result.status !== 'success') {
      throw new Error(result.message || result.reason || 'Crawl failed');
    }
    
    const currentShopSold = parseSold(result.shopSold);
    
    console.log(`✅ [Shop Only] Shop: ${result.shopName}, Sold: ${result.shopSold}`);
    
    // Calculate growth
    let growth = null;
    if (previousShopSold !== null && currentShopSold !== null && previousShopSold > 0) {
      const diff = currentShopSold - previousShopSold;
      const percent = ((diff / previousShopSold) * 100).toFixed(1);
      growth = {
        previous: previousShopSold,
        current: currentShopSold,
        diff: diff,
        percent: parseFloat(percent)
      };
      console.log(`📊 [Shop Only] Growth: ${diff > 0 ? '+' : ''}${diff} (${percent}%)`);
      
      // Update history item with growth data
      const historyItems = readHistory();
      const historyItem = historyItems.find(it => it.url === nurl);
      if (historyItem) {
        historyItem.shopGrowth = growth;
        historyItem.note = (historyItem.note || '') + ` | Growth: ${diff > 0 ? '+' : ''}${diff} (${percent}%)`;
        historyItem.updatedAt = new Date().toISOString();
        writeHistory(historyItems);
        console.log(`💾 [Shop Only] Saved growth data to history`);
      }
    }
    
    res.json({
      success: true,
      shopName: result.shopName || '',
      shopSold: result.shopSold || '',
      url: url,
      growth: growth,
      historyId: result.id
    });
  } catch (error) {
    console.error('❌ [Shop Only] Error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to crawl shop data',
      details: error.response?.data || error.stack
    });
  }
});

// Shared browser instance for login + crawl (persistent, headful)
let sharedBrowser = null;

app.post('/api/open-shared-browser', async (req, res) => {
  try {
    // Close existing browser if any
    if (sharedBrowser) {
      try {
        await sharedBrowser.close();
      } catch (e) {
        console.log('Previous browser already closed');
      }
      sharedBrowser = null;
    }

    console.log('🌐 Opening shared browser for TikTok (login + crawl)...');
    
    // Launch browser with persistent context and headful mode
    const launchOptions = createLaunchOptions(true);
    launchOptions.headless = false; // Show browser window - người dùng có thể xem
    launchOptions.defaultViewport = null; // Use full viewport
    
    sharedBrowser = await puppeteer.launch(launchOptions);
    const pages = await sharedBrowser.pages();
    const page = pages[0] || await sharedBrowser.newPage();
    
    // Navigate to TikTok homepage
    await page.goto('https://www.tiktok.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('✅ Shared browser opened!');
    console.log('💡 You can:');
    console.log('   1. Login to TikTok');
    console.log('   2. Install Chrome extensions');
    console.log('   3. Keep this browser open to use for all crawl operations');
    console.log('⚠️  Do NOT close this window manually - use "Đóng Browser" button');
    
    res.json({
      success: true,
      message: 'Shared browser opened! You can login and install extensions. This browser will be used for all crawl operations.'
    });
  } catch (error) {
    console.error('❌ Error opening browser:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to open browser'
    });
  }
});

app.post('/api/close-shared-browser', async (req, res) => {
  try {
    if (sharedBrowser) {
      await sharedBrowser.close();
      sharedBrowser = null;
      
      console.log('✅ Shared browser closed');
      res.json({ success: true, message: 'Browser closed' });
    } else {
      res.json({ success: false, message: 'No browser is open' });
    }
  } catch (error) {
    console.error('❌ Error closing browser:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shared-browser-status', (req, res) => {
  res.json({
    isOpen: sharedBrowser !== null,
    message: sharedBrowser ? 'Shared browser is open and ready for crawling' : 'No browser is open'
  });
});

// Health check endpoint for Cloudflare Tunnel testing
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'TikTok Shop Crawler API'
  });
});

const PORT = process.env.PORT || 8080;

// Create HTTP server with extended timeout for bulk crawling
const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Health: http://localhost:${PORT}/api/health`);
});

// Increase timeout to 10 minutes for processing 50+ links
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 610000; // 10 minutes + 10 seconds
server.headersTimeout = 620000; // 10 minutes + 20 seconds
