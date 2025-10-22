/**
 * Test Crawl Multiple TikTok Shop Links
 * Check patterns, CAPTCHA, and data extraction
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';

// Test URLs
const TEST_URLS = [
  'https://www.tiktok.com/shop/pdp/1731808374866153635',
  'https://www.tiktok.com/shop/pdp/1731808216458170531',
  'https://www.tiktok.com/shop/pdp/cute-christmas-movie-watching-shirt-sweatshirt-fur-frauen/1731714475920101400',
  'https://www.tiktok.com/shop/pdp/retro-christmas-nutcracker-sweatshirt-unisex-fit-soft-fabric/1731643452134690842',
  'https://www.tiktok.com/shop/pdp/christmas-sweatshirt-by-oak-haven-apparel-cozy-holiday-pullover-cute-winter-crewneck-for-women-eco-f/1731779090052649084',
  'https://www.tiktok.com/shop/pdp/1731808408834838691',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1729424774588174723?source=ecommerce_store',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1729471837301019011?source=ecommerce_store'
];

// NEW PROXY
const PROXY_STRING = '135.148.11.203:31280:PUS89186:PrX7CMv2';

function parseProxy(proxyStr) {
  const parts = proxyStr.split(':');
  return {
    host: parts[0],
    port: parseInt(parts[1]),
    username: parts[2],
    password: parts[3]
  };
}

async function crawlUrl(page, url, index) {
  console.log(`\n[${ index + 1}/${TEST_URLS.length}] Testing: ${url.substring(0, 80)}...`);
  
  const result = {
    url: url,
    status: null,
    hasCaptcha: false,
    hasContent: false,
    title: null,
    price: null,
    sold: null,
    selectors: {
      h1Count: 0,
      imgCount: 0,
      priceElements: 0,
      dataAttributes: []
    },
    errors: []
  };

  try {
    // Navigate
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    result.status = response.status();
    console.log(`   Status: ${result.status}`);

    if (result.status !== 200) {
      result.errors.push(`Bad status: ${result.status}`);
      return result;
    }

    // Wait for content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for CAPTCHA
    const captchaSelectors = [
      'img.verify_img_slide',
      'img.secsdk-captcha-img',
      'canvas[id*="captcha"]',
      '#captcha-verify'
    ];

    for (const sel of captchaSelectors) {
      const element = await page.$(sel);
      if (element) {
        result.hasCaptcha = true;
        console.log(`   🔒 CAPTCHA detected: ${sel}`);
        break;
      }
    }

    // Extract data with multiple selectors
    const extracted = await page.evaluate(() => {
      const data = {
        title: null,
        price: null,
        sold: null,
        h1Count: 0,
        imgCount: 0,
        priceElements: 0,
        dataAttributes: [],
        allText: '',
        htmlLength: document.body.innerHTML.length
      };

      // Count elements
      data.h1Count = document.querySelectorAll('h1').length;
      data.imgCount = document.querySelectorAll('img').length;
      data.priceElements = document.querySelectorAll('[class*="price"], [class*="Price"]').length;

      // Find data-* attributes
      document.querySelectorAll('[data-e2e]').forEach(el => {
        const attr = el.getAttribute('data-e2e');
        if (!data.dataAttributes.includes(attr)) {
          data.dataAttributes.push(attr);
        }
      });

      // Try to find title
      const titleSelectors = [
        'h1[data-e2e="product-title"]',
        'h1[class*="title"]',
        'h1[class*="Title"]',
        'h1'
      ];
      
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 10) {
          data.title = el.textContent.trim().substring(0, 100);
          break;
        }
      }

      // Try to find price
      const priceSelectors = [
        '[data-e2e="product-price"]',
        '[class*="pdp-price"]',
        '[class*="product-price"]',
        'span[class*="Price"]'
      ];
      
      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.match(/\$|USD|\d+\.\d+/)) {
          data.price = el.textContent.trim();
          break;
        }
      }

      // Try to find sold count
      const soldSelectors = [
        '[data-e2e="product-sold"]',
        '[class*="sold"]',
        'span[class*="sold"]'
      ];
      
      for (const sel of soldSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.match(/sold|Sold|\d+/)) {
          data.sold = el.textContent.trim();
          break;
        }
      }

      // Get some text for analysis
      data.allText = document.body.innerText.substring(0, 500);
      
      return data;
    });

    result.title = extracted.title;
    result.price = extracted.price;
    result.sold = extracted.sold;
    result.selectors = {
      h1Count: extracted.h1Count,
      imgCount: extracted.imgCount,
      priceElements: extracted.priceElements,
      dataAttributes: extracted.dataAttributes,
      htmlLength: extracted.htmlLength
    };
    result.hasContent = extracted.htmlLength > 10000;

    // Log results
    if (result.title) {
      console.log(`   ✅ Title: ${result.title.substring(0, 60)}...`);
    } else {
      console.log(`   ❌ No title found`);
    }

    if (result.price) {
      console.log(`   ✅ Price: ${result.price}`);
    } else {
      console.log(`   ❌ No price found`);
    }

    console.log(`   📊 Elements: ${result.selectors.h1Count} h1, ${result.selectors.imgCount} images, ${result.selectors.priceElements} price elements`);
    
    if (result.selectors.dataAttributes.length > 0) {
      console.log(`   🏷️  Data attributes: ${result.selectors.dataAttributes.join(', ')}`);
    }

    // Save screenshot for analysis
    const screenshotPath = `debug/test_url_${index + 1}_${Date.now()}.png`;
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: false // Just viewport
    });
    console.log(`   📸 Screenshot: ${screenshotPath}`);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    result.errors.push(error.message);
  }

  return result;
}

async function testMultipleUrls() {
  console.log('='.repeat(70));
  console.log('🧪 Testing Multiple TikTok Shop URLs');
  console.log('='.repeat(70));
  console.log(`\n📋 Testing ${TEST_URLS.length} URLs with proxy: ${PROXY_STRING.split(':')[0]}`);

  // Create debug folder
  if (!fs.existsSync('debug')) {
    fs.mkdirSync('debug');
  }

  // Parse proxy
  const proxyConfig = parseProxy(PROXY_STRING);

  // Launch browser with proxy
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      `--proxy-server=http://${proxyConfig.host}:${proxyConfig.port}`
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // Authenticate proxy
  await page.authenticate({
    username: proxyConfig.username,
    password: proxyConfig.password
  });

  const results = [];

  // Test each URL
  for (let i = 0; i < TEST_URLS.length; i++) {
    const result = await crawlUrl(page, TEST_URLS[i], i);
    results.push(result);
    
    // Wait between requests
    if (i < TEST_URLS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  const successCount = results.filter(r => r.status === 200 && !r.errors.length).length;
  const captchaCount = results.filter(r => r.hasCaptcha).length;
  const dataCount = results.filter(r => r.title && r.price).length;

  console.log(`\n✅ Successful requests: ${successCount}/${TEST_URLS.length}`);
  console.log(`🔒 CAPTCHA encountered: ${captchaCount}/${TEST_URLS.length}`);
  console.log(`📦 Data extracted: ${dataCount}/${TEST_URLS.length}`);

  // Common patterns
  console.log('\n📋 Common Patterns Found:');
  
  const allDataAttrs = new Set();
  results.forEach(r => {
    r.selectors.dataAttributes.forEach(attr => allDataAttrs.add(attr));
  });
  
  if (allDataAttrs.size > 0) {
    console.log(`   Data attributes: ${Array.from(allDataAttrs).join(', ')}`);
  }

  // Successful extractions
  const successful = results.filter(r => r.title || r.price);
  if (successful.length > 0) {
    console.log('\n✅ URLs with Data:');
    successful.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.url.substring(0, 60)}...`);
      if (r.title) console.log(`      Title: ${r.title.substring(0, 60)}...`);
      if (r.price) console.log(`      Price: ${r.price}`);
    });
  }

  // Failed extractions
  const failed = results.filter(r => !r.title && !r.price && r.status === 200);
  if (failed.length > 0) {
    console.log('\n❌ URLs without Data (but loaded):');
    failed.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.url.substring(0, 60)}...`);
      console.log(`      HTML length: ${r.selectors.htmlLength}`);
      console.log(`      Elements: ${r.selectors.h1Count} h1, ${r.selectors.priceElements} price`);
    });
  }

  // Save results
  const reportPath = `debug/test_results_${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Full results saved: ${reportPath}`);

  console.log('\n' + '='.repeat(70));
}

testMultipleUrls().catch(console.error);
