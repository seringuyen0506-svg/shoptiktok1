/**
 * TikTok Shop Crawler Test
 * Handles vm.tiktok.com short links → product pages
 * 
 * Features:
 * - Follow redirects from vm.tiktok.com
 * - Handle TikTok Shop specific headers
 * - Detect and solve CAPTCHA if needed
 * - Extract product information
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';

// Configuration
const TIKTOK_SHOP_URL = 'https://vm.tiktok.com/ZTHnhmN6d3fAG-aJavt/';
const HMCAPTCHA_API_KEY = '57c29b7fde6f9b04ba13a65f1e92ba5d'; // From your config

// Proxy configuration (comment out to test without proxy)
const PROXY_CONFIG = null; // DISABLED - Testing without proxy first
/*
const PROXY_CONFIG = {
  host: 'p.webshare.io',
  port: 80,
  username: 'ppuozozl-rotate',
  password: 'c8iqnclktjv9'
};
*/

function parseProxy(proxyStr) {
  const parts = proxyStr.split(':');
  if (parts.length >= 4) {
    return {
      host: parts[0],
      port: parseInt(parts[1]),
      username: parts[2],
      password: parts.slice(3).join(':')
    };
  }
  return null;
}

function buildProxyAgent(config) {
  if (!config) return null;
  
  const auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}`;
  const proxyUrl = `http://${auth}@${config.host}:${config.port}`;
  
  return new HttpsProxyAgent(proxyUrl, {
    rejectUnauthorized: false
  });
}

async function solveCaptcha(page, apiKey) {
  console.log('\n🔍 Checking for CAPTCHA...');
  
  // Expanded selectors for TikTok CAPTCHA
  const captchaSelectors = [
    'img.verify_img_slide',           // Slide CAPTCHA
    'img.secsdk-captcha-img',         // ByteDance security
    'canvas[id*="captcha"]',
    'img[alt*="captcha"]',
    'img[src*="captcha"]',
    'div.captcha_verify_img_slide img',
    '#captcha-verify img',
    'img.verify-img',
    'img[class*="slide"]',
    'img[class*="puzzle"]'
  ];

  let captchaElement = null;
  
  for (const selector of captchaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const box = await element.boundingBox();
        if (box && box.width >= 200 && box.height >= 100) {
          console.log(`✅ Found CAPTCHA with selector: ${selector}`);
          console.log(`   Size: ${Math.round(box.width)}x${Math.round(box.height)}px`);
          captchaElement = element;
          break;
        }
      }
    } catch (err) {
      continue;
    }
  }

  if (!captchaElement) {
    console.log('ℹ️  No CAPTCHA detected');
    return null;
  }

  // Take screenshot
  const screenshotBuffer = await captchaElement.screenshot();
  const timestamp = Date.now();
  const screenshotPath = `debug/captcha_tiktok_shop_${timestamp}.png`;
  
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log(`📸 CAPTCHA screenshot saved: ${screenshotPath}`);
  console.log(`   Size: ${(screenshotBuffer.length / 1024).toFixed(2)} KB`);

  // Solve CAPTCHA using hmcaptcha.com API
  const base64Image = screenshotBuffer.toString('base64');
  
  try {
    console.log('🤖 Sending to hmcaptcha.com API...');
    const response = await axios.post('https://hmcaptcha.com/api/recognition/v1', {
      Type: 'ALL_CAPTCHA_SLIDE',
      Image: base64Image
    }, {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('📬 API Response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.offset) {
      const offset = response.data.offset;
      console.log(`✅ CAPTCHA solved! Offset: ${offset}px`);
      return offset;
    } else {
      console.error('❌ Cannot solve CAPTCHA:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ CAPTCHA solving error:', error.response?.data || error.message);
    return null;
  }
}

async function testTikTokShop() {
  console.log('='.repeat(60));
  console.log('🛍️  TikTok Shop Crawler Test');
  console.log('='.repeat(60));
  console.log(`\n📍 URL: ${TIKTOK_SHOP_URL}`);
  
  // Test proxy connection first
  if (PROXY_CONFIG) {
    console.log(`\n🌐 Testing proxy: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
    const proxyAgent = buildProxyAgent(PROXY_CONFIG);
    
    try {
      const testResponse = await axios.get('https://api.ipify.org?format=json', {
        httpsAgent: proxyAgent,
        timeout: 10000
      });
      console.log(`✅ Proxy working! IP: ${testResponse.data.ip}`);
    } catch (error) {
      console.error(`❌ Proxy test failed: ${error.message}`);
      console.log('⚠️  Continuing without proxy...\n');
      PROXY_CONFIG.host = null; // Disable proxy
    }
  }

  // Create debug folder
  if (!fs.existsSync('debug')) {
    fs.mkdirSync('debug');
  }

  // Launch browser
  const launchOptions = {
    headless: false, // Show browser for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ]
  };

  // Add proxy to browser args if configured
  if (PROXY_CONFIG && PROXY_CONFIG.host) {
    const proxyServer = `${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
    launchOptions.args.push(`--proxy-server=http://${proxyServer}`);
    console.log(`\n🔧 Browser proxy configured: ${proxyServer}`);
  }

  console.log('\n🚀 Launching browser...');
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  // Set realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // Authenticate proxy if configured
  if (PROXY_CONFIG && PROXY_CONFIG.host) {
    await page.authenticate({
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password
    });
    console.log('✅ Proxy authentication configured');
  }

  // Set extra headers for TikTok Shop
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.tiktok.com/',
    'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Upgrade-Insecure-Requests': '1'
  });

  try {
    console.log('\n🌐 Navigating to TikTok Shop...');
    const response = await page.goto(TIKTOK_SHOP_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const status = response.status();
    const finalUrl = page.url();
    
    console.log(`\n📊 Navigation Result:`);
    console.log(`   Status: ${status}`);
    console.log(`   Final URL: ${finalUrl}`);
    console.log(`   Title: ${await page.title()}`);

    // Check if we got error page
    if (finalUrl.includes('chrome-error://')) {
      console.error('❌ Browser error page detected!');
      console.log('💡 This usually means proxy authentication failed');
      
      // Save error page
      const html = await page.content();
      fs.writeFileSync('debug/error_page.html', html);
      console.log('📄 Error page saved to debug/error_page.html');
      
      await browser.close();
      return;
    }

    // Wait a bit for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for CAPTCHA
    const captchaOffset = await solveCaptcha(page, HMCAPTCHA_API_KEY);
    
    if (captchaOffset !== null) {
      console.log(`\n🎯 Applying CAPTCHA solution: ${captchaOffset}px`);
      
      // Find slider and drag
      const slider = await page.$('.secsdk_captcha_slider_btn, .captcha-slider-btn, button[class*="slider"]');
      
      if (slider) {
        const box = await slider.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + captchaOffset, box.y + box.height / 2, { steps: 20 });
        await page.mouse.up();
        
        console.log('✅ Slider moved');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Extract product info
    console.log('\n📦 Extracting product data...');
    
    const productData = await page.evaluate(() => {
      const data = {};
      
      // Try to find product title
      const titleEl = document.querySelector('h1, [class*="product-title"], [class*="ProductTitle"]');
      data.title = titleEl ? titleEl.textContent.trim() : null;
      
      // Try to find price
      const priceEl = document.querySelector('[class*="price"], [class*="Price"]');
      data.price = priceEl ? priceEl.textContent.trim() : null;
      
      // Try to find sold count
      const soldEl = document.querySelector('[class*="sold"], [class*="Sold"]');
      data.sold = soldEl ? soldEl.textContent.trim() : null;
      
      // Check if page has content
      data.hasContent = document.body.innerText.length > 1000;
      
      return data;
    });

    console.log('\n📋 Product Data:');
    console.log(JSON.stringify(productData, null, 2));

    // Save full page screenshot
    await page.screenshot({ 
      path: `debug/tiktok_shop_page_${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Full page screenshot saved');

    // Save HTML
    const html = await page.content();
    fs.writeFileSync(`debug/tiktok_shop_page_${Date.now()}.html`, html);
    console.log('📄 HTML saved');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Save error screenshot
    await page.screenshot({ path: `debug/error_${Date.now()}.png` });
    console.log('📸 Error screenshot saved');
  } finally {
    console.log('\n🔒 Closing browser...');
    await browser.close();
    console.log('✅ Test complete!');
  }
}

// Run test
testTikTokShop().catch(console.error);
