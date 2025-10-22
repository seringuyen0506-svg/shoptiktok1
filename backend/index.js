import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// Import vanilla puppeteer to access executablePath helper
import vanillaPuppeteer from 'puppeteer';

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
    if (envPath && fs.existsSync(envPath)) return envPath;
  } catch {}

  try {
    // puppeteer >= v19 exposes executablePath()
    const p = typeof vanillaPuppeteer.executablePath === 'function' ? vanillaPuppeteer.executablePath() : null;
    if (p && fs.existsSync(p)) return p;
  } catch {}

  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chrome',
    '/opt/google/chrome/chrome'
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
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

// ===== URL + Proxy helpers =====
// Helper: Parse proxy string (handle complex usernames with colons)
function parseProxy(proxyStr) {
  if (!proxyStr || typeof proxyStr !== 'string') return null;
  const parts = proxyStr.split(':');
  if (parts.length < 2) return null;
  
  const host = parts[0];
  const port = parts[1];
  
  if (parts.length >= 4) {
    const username = parts[2];
    // Join remaining parts as password (in case password contains :)
    const password = parts.slice(3).join(':');
    return { host, port, username, password, hasAuth: true };
  }
  
  return { host, port, hasAuth: false };
}

function buildProxyAgent(proxyStr) {
  if (!proxyStr) return undefined;
  try {
    const parsed = parseProxy(proxyStr);
    if (!parsed) return undefined;
    
    const config = {
      host: parsed.host,
      port: parsed.port,
      rejectUnauthorized: false // ⭐ FIX SSL errors
    };
    
    if (parsed.hasAuth) {
      config.auth = `${encodeURIComponent(parsed.username)}:${encodeURIComponent(parsed.password)}`;
    }
    
    return new HttpsProxyAgent(config);
  } catch (e) {
    console.error('⚠️ Proxy agent build error:', e.message);
  }
  return undefined;
}

async function resolveShortUrl(inputUrl, proxyStr) {
  try {
    let current = inputUrl;
    const agent = buildProxyAgent(proxyStr);
    for (let i = 0; i < 5; i++) {
      // Only try to resolve typical short domains
      if (!/\b(vm|vt)\.tiktok\.com\b|\/t\//i.test(current)) break;
      const resp = await axios.head(current, {
        maxRedirects: 0,
        validateStatus: s => s >= 200 && s < 400,
        httpAgent: agent,
        httpsAgent: agent,
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

async function autoDetectPrefsFromProxy(proxyStr) {
  // Defaults to US if detection fails
  const fallback = {
    lang: 'en-US',
    timezone: 'America/New_York',
    geolocation: { latitude: 40.7128, longitude: -74.0060, accuracy: 100 },
    source: 'default'
  };
  try {
    if (!proxyStr) return fallback;
    const agent = buildProxyAgent(proxyStr);
    // Use ipapi.co for quick geo/timezone
    const resp = await axios.get('https://ipapi.co/json', {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 6000,
      validateStatus: s => s >= 200 && s < 400
    });
    const d = resp.data || {};
    const country = d.country || d.country_code || '';
    const tz = d.timezone || 'America/New_York';
    const lat = Number(d.latitude);
    const lon = Number(d.longitude);
    const lang = langFromCountry(country);
    const geo = (Number.isFinite(lat) && Number.isFinite(lon))
      ? { latitude: lat, longitude: lon, accuracy: 100 }
      : { latitude: 40.7128, longitude: -74.0060, accuracy: 100 };
    return { lang, timezone: tz, geolocation: geo, source: 'ipapi' };
  } catch (e) {
    console.log('Locale auto-detect failed, using defaults:', e.message);
    return fallback;
  }
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

function upsertHistoryItem({ url, shopName, shopSold, productName, productSold, note, shopId, shopSlug }) {
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
    let captchaElement = await page.$('img[src*="captcha"], img[alt*="captcha"], [class*="captcha"] canvas, canvas[class*="captcha"], [class*="captcha"]').catch(() => null);
    let captchaClip = null; // {x,y,width,height}

    // If not found on main page, search inside iframes with url including captcha/verify
    if (!captchaElement) {
      const frames = page.frames();
      for (const f of frames) {
        const furl = f.url().toLowerCase();
        if (furl.includes('captcha') || furl.includes('verify')) {
          try {
            captchaElement = await f.$('img[src*="captcha"], img[alt*="captcha"], [class*="captcha"] canvas, canvas, [class*="captcha"]');
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
      screenshot = await captchaElement.screenshot({ encoding: 'base64' });
      console.log('✓ Screenshot captured (element)');
      const box = await captchaElement.boundingBox().catch(() => null);
      if (box) captchaClip = { x: box.x, y: box.y, width: box.width, height: box.height };
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
          throw new Error(resp.data.Message || 'Solver returned ERROR status');
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

// Check IP endpoint
app.post('/api/check-ip', async (req, res) => {
  const { proxy } = req.body;
  
  console.log('🔍 Checking IP with proxy:', proxy || 'No proxy');
  
  try {
    // Launch browser with proxy
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors'
      ],
      ignoreHTTPSErrors: true,
      executablePath: resolveChromiumExecutablePath() || undefined
    };
    
    // Parse proxy if provided
    if (proxy && proxy.trim()) {
      const parsed = parseProxy(proxy);
      if (parsed && parsed.hasAuth) {
        launchOptions.args.push(`--proxy-server=${parsed.host}:${parsed.port}`);
        console.log('✓ Proxy configured:', `${parsed.host}:${parsed.port}`);
      } else if (parsed) {
        launchOptions.args.push(`--proxy-server=${parsed.host}:${parsed.port}`);
        console.log('✓ Proxy configured (no auth):', `${parsed.host}:${parsed.port}`);
      } else {
        return res.json({ error: 'Invalid proxy format. Use: host:port:username:password' });
      }
    }
    
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Authenticate proxy if needed
    if (proxy && proxy.trim()) {
      const parsed = parseProxy(proxy);
      if (parsed && parsed.hasAuth) {
        await page.authenticate({
          username: parsed.username,
          password: parsed.password
        });
        console.log('✓ Proxy authenticated');
      }
    }
    
    // Check IP via api.ipify.org
    try {
      await page.goto('https://api.ipify.org?format=json', { 
        waitUntil: 'networkidle2',
        timeout: 20000 
      });
      
      const ipData = await page.evaluate(() => {
        try {
          return JSON.parse(document.body.textContent);
        } catch {
          return null;
        }
      });
      
      if (ipData && ipData.ip) {
        console.log('✓ IP detected:', ipData.ip);
        
        // Get more info from ipinfo.io
        let location = 'Unknown';
        let org = 'Unknown';
        let timezone = '';
        let isDatacenter = false;
        
        try {
          await page.goto(`https://ipinfo.io/${ipData.ip}/json`, {
            waitUntil: 'networkidle2',
            timeout: 15000
          });
          
          const detailData = await page.evaluate(() => {
            try {
              return JSON.parse(document.body.textContent);
            } catch {
              return {};
            }
          });
          
          if (detailData) {
            location = `${detailData.city || ''}, ${detailData.region || ''}, ${detailData.country || ''}`.replace(/, ,/g, ',').trim();
            org = detailData.org || 'Unknown';
            timezone = detailData.timezone || '';
            
            // Check if datacenter
            const orgLower = org.toLowerCase();
            isDatacenter = orgLower.includes('digitalocean') ||
                          orgLower.includes('amazon') ||
                          orgLower.includes('google') ||
                          orgLower.includes('webshare') ||
                          orgLower.includes('ovh') ||
                          orgLower.includes('hosting') ||
                          orgLower.includes('datacenter') ||
                          orgLower.includes('cloud');
            
            console.log('✓ Location:', location);
            console.log('✓ ISP:', org);
            console.log('✓ Datacenter?', isDatacenter);
          }
        } catch (e) {
          console.log('⚠️ Could not get detailed IP info:', e.message);
        }
        
        await browser.close();
        
        return res.json({
          success: true,
          ip: ipData.ip,
          location: location,
          org: org,
          timezone: timezone,
          isDatacenter: isDatacenter
        });
      } else {
        throw new Error('Could not detect IP');
      }
    } catch (e) {
      await browser.close();
      throw e;
    }
    
  } catch (error) {
    console.error('❌ IP check failed:', error.message);
    return res.json({ 
      error: 'Không thể kiểm tra IP: ' + error.message 
    });
  }
});

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
      const SELF_PORT = process.env.PORT || 5000;
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
  const { url, apiKey, proxy } = req.body || {};
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
    if (proxy) {
      const parsed = parseProxy(proxy);
      if (parsed) {
        launchOptions.args.push(`--proxy-server=${parsed.host}:${parsed.port}`);
      }
    }
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    if (proxy) {
      const parsed = parseProxy(proxy);
      if (parsed && parsed.hasAuth) {
        await page.authenticate({ username: parsed.username, password: parsed.password });
      }
    }
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

// Crawl endpoint
app.post('/api/crawl', async (req, res) => {
  const { links, proxy, apiKey, note, prefs } = req.body;
  if (!Array.isArray(links)) return res.status(400).json({ error: 'links must be an array' });
  // Concurrency: allow client to set, but clamp to 1..3 to avoid overload
  const requestedConc = Number(req.body?.concurrency);
  const CONCURRENCY = Math.min(Math.max(Number.isFinite(requestedConc) ? requestedConc : 2, 1), 3);
  console.log(`⚙️ Concurrency set to ${CONCURRENCY} (requested=${requestedConc || 'default'})`);
  
  if (CONCURRENCY > 2) {
    console.log('⚠️ WARNING: Concurrency > 2 tăng nguy cơ CAPTCHA/gate/524. Khuyến nghị: 1-2 luồng.');
  }

  const results = [];

  // Preferences for locale/region
  // 1) Auto-detect from proxy if available and prefs missing
  let detected = null;
  if (!prefs && proxy) {
    detected = await autoDetectPrefsFromProxy(proxy).catch(() => null);
  }
  const basePrefs = prefs || detected || { lang: 'en-US', timezone: 'America/New_York', geolocation: { latitude: 40.7128, longitude: -74.0060, accuracy: 100 } };
  const langPref = (basePrefs && typeof basePrefs.lang === 'string' && basePrefs.lang.trim()) ? basePrefs.lang.trim() : 'en-US';
  const timezonePref = (basePrefs && typeof basePrefs.timezone === 'string' && basePrefs.timezone.trim()) ? basePrefs.timezone.trim() : 'America/New_York';
  const geolocationPref = (basePrefs && typeof basePrefs.geolocation === 'object' && basePrefs.geolocation)
    ? { latitude: Number(basePrefs.geolocation.latitude) || 40.7128, longitude: Number(basePrefs.geolocation.longitude) || -74.0060, accuracy: Number(basePrefs.geolocation.accuracy) || 100 }
    : { latitude: 40.7128, longitude: -74.0060, accuracy: 100 };

  // Worker function to crawl a single URL (mostly existing logic)
  const crawlUrl = async (url) => {
    try {
      console.log('---\nCrawling:', url);
      // Random delay giữa các request (1-3s) to stagger workers
      await randomDelay(1000, 3000);
      
      // Puppeteer crawl
      let browser;
      let html = '';
      let shopName = '', shopSold = '', productName = '', productSold = '';
      try {
        // Resolve short URLs ahead of time to reduce redirects/timeouts
        const targetUrl = await resolveShortUrl(url, proxy);
        if (targetUrl !== url) {
          console.log('  → Resolved short URL to:', targetUrl);
        }
        // Cấu hình Puppeteer với stealth mode + SSL bypass
        const launchOptions = {
          headless: 'new', // Sử dụng headless mode mới
          ignoreHTTPSErrors: true, // ⭐ Bỏ qua SSL errors
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--ignore-certificate-errors',           // ⭐ Ignore cert errors
            '--ignore-certificate-errors-spki-list', // ⭐ Ignore cert validation
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--disable-extensions',
            `--lang=${langPref}`
          ],
          executablePath: resolveChromiumExecutablePath() || undefined
        };
        
        // Parse proxy đúng format: host:port:username:password
        if (proxy) {
          const parsed = parseProxy(proxy);
          if (parsed) {
            launchOptions.args.push(`--proxy-server=${parsed.host}:${parsed.port}`);
          }
        }
        
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        // Emulate timezone + grant geo permission + set geolocation
        try {
          const context = browser.defaultBrowserContext();
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
        
        // Xử lý proxy authentication nếu có
        if (proxy) {
          const parsed = parseProxy(proxy);
          if (parsed && parsed.hasAuth) {
            await page.authenticate({ username: parsed.username, password: parsed.password });
            console.log('Proxy authenticated:', parsed.username);
          }
        }
        
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
        
        // Ẩn dấu hiệu automation + US fingerprinting
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
          window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
          
          // Permissions
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
          
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
        
        // ⚠️ CHECK CAPTCHA NGAY SAU KHI LOAD TRANG (ENUM)
        const detectedType = await detectCaptchaType(page);
        if (detectedType !== 'NONE') {
          console.log('⚠️ CAPTCHA detected of type:', detectedType);
          if (!apiKey) {
            console.log('❌ No API key provided - cannot solve CAPTCHA');
            results.push({
              url,
              status: 'captcha_detected',
              reason: 'captcha',
              message: 'CAPTCHA detected but no API key provided. Please add hmcaptcha API key.',
              suggestion: 'Thêm API Key hmcaptcha.com hoặc giảm tốc độ/concurrency để giảm CAPTCHA.'
            });
            await browser.close();
            return;
          }
          // GỌI HÀM GIẢI CAPTCHA
          console.log('🔧 Solving CAPTCHA with hmcaptcha...');
          const captchaSolved = await solveCaptchaIfNeeded(page, apiKey);
          if (!captchaSolved.success) {
            console.log('❌ CAPTCHA NOT solved! Message:', captchaSolved.error);
            results.push({
              url,
              status: 'captcha_failed',
              reason: 'captcha',
              message: 'CAPTCHA detected, solver failed: ' + (captchaSolved.error || 'Unknown error'),
              suggestion: 'Thử lại với proxy khác, giảm concurrency, hoặc kiểm tra API key.'
            });
            await browser.close();
            return;
          }
          console.log('✅ CAPTCHA solved! Waiting for page reload...');
          await randomDelay(3000, 5000);
          
          // Kiểm tra xem có thực sự vượt qua gate không
          console.log('🔍 Verifying page after CAPTCHA solve...');
          const stillGated = await page.evaluate(() => {
            const html = document.documentElement.outerHTML;
            const text = document.body.innerText.toLowerCase();
            const isSmallHtml = html.length < 30000;
            const hasGateKeywords = /captcha|verify|not available|region|access denied|please try again|slide to verify/i.test(text);
            return { isSmallHtml, hasGateKeywords, htmlSize: html.length };
          });
          
          if (stillGated.isSmallHtml || stillGated.hasGateKeywords) {
            console.log(`❌ Still at gate/verify page after solve! HTML size: ${stillGated.htmlSize}, keywords: ${stillGated.hasGateKeywords}`);
            results.push({
              url,
              status: 'gate_stuck',
              reason: 'gate',
              message: `Still stuck at verification page after CAPTCHA solve. HTML size: ${stillGated.htmlSize}`,
              suggestion: 'Proxy bị chặn hoặc fingerprint kém. Thử proxy residential sạch hơn, giảm concurrency xuống 1, hoặc đổi IP/region.'
            });
            await browser.close();
            return;
          }
          console.log('✓ Successfully passed gate, HTML size:', stillGated.htmlSize);
        } else {
          console.log('✓ No CAPTCHA detected - proceeding with extraction');
        }
        
        // SAU KHI GIẢI CAPTCHA (hoặc không có captcha) → TIẾP TỤC CRAWL
  console.log('Waiting for API requests...');
  await randomDelay(1500, 3000); // shorten to reduce total time
        
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
        
        // Chờ selector xuất hiện (tối đa 15s)
        let foundSelectors = false;
        try {
          // Use fallback selectors with short timeouts
          const titleEl = await waitForAnySelector(page, [
            '[data-e2e="product-title"]',
            'h1[role="heading"]',
            'h1[class*="title"]',
            'span[class*="Semibold"]',
            'h1'
          ], 8000);
          if (!titleEl) throw new Error('title selector not found');
          console.log('✓ Found selectors on page');
          foundSelectors = true;
        } catch (e) {
          console.log('⚠ Timeout waiting for selectors:', e.message);
          
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
                    suggestion: 'Đổi proxy residential sạch, giảm concurrency, kiểm tra API key và thử lại.'
                  });
                  await browser.close();
                  return;
                }
              } else {
                console.log('ℹ Gate detected but no explicit CAPTCHA type recognized. Treat as gate.');
                results.push({
                  url,
                  status: 'gate_detected',
                  reason: 'gate',
                  message: `Page stuck at gate/verify. HTML size: ${gateCheck.htmlSize}B`,
                  suggestion: 'IP/proxy bị TikTok chặn. Đổi proxy residential, giảm concurrency xuống 1, hoặc thử region khác.'
                });
                await browser.close();
                return;
              }
            } else {
              results.push({
                url,
                status: 'gate_detected',
                reason: 'gate',
                message: `Page stuck at gate/verify. HTML size: ${gateCheck.htmlSize}B`,
                suggestion: 'Cần thêm API Key hmcaptcha để thử solve. Ngoài ra, đổi proxy residential/giảm concurrency.'
              });
              await browser.close();
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
        
        await browser.close();
      } catch (err) {
        if (browser) await browser.close();
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
          suggestion: 'Proxy/IP bị chặn hoàn toàn. Đổi proxy residential sạch, giảm concurrency = 1, thử lại sau vài phút.'
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
          message: 'Product is region-locked. Use Vietnam TikTok link or correct regional proxy for full data.',
          suggestion: 'Dùng proxy đúng khu vực sản phẩm, hoặc link vt.tiktok.com nội địa.'
        };
        results.push(item);
        try { upsertHistoryItem({ url, shopName: item.shopName, shopSold: item.shopSold, productName: item.productName, productSold: item.productSold, note, shopId: item.shopId, shopSlug: item.shopSlug }); } catch {}
        return; // finish this URL
      }
      
      // Kiểm tra xem có dữ liệu không (non geo-blocked case)
      if (shopName || shopSold || productName || productSold) {
        console.log('✓ Successfully extracted data:', { shopName, shopSold, productName, productSold });
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
        try { upsertHistoryItem({ url, shopName, shopSold, productName, productSold, note, shopId: item.shopId, shopSlug: item.shopSlug }); } catch {}
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
          suggestion: 'Thử proxy khác, giảm concurrency, hoặc chạy lại vào thời điểm khác.'
        };
        results.push(item);
      }
      
    } catch (error) {
      console.log('✗ Error crawling', url, ':', error.message);
      const item = { url, status: 'error', reason: 'error', error: error.message, suggestion: 'Kiểm tra proxy/API, thử lại; nếu qua Cloudflare Tunnel hãy bật chế độ chạy nền / async.' };
      results.push(item);
    }
  };

  // Simple promise pool
  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }).map(async () => {
    while (true) {
      const current = idx++;
      if (current >= links.length) break;
      const url = links[current];
      await crawlUrl(url);
    }
  });

  await Promise.all(workers);
  res.json({ results });
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
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Health: http://localhost:${PORT}/api/health`);
});
