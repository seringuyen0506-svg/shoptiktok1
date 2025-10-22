/**
 * ✅ CORRECT WORKFLOW: TikTok Shop Crawler
 * 
 * WORKFLOW:
 * 1. KẾT NỐI PROXY + Verify hoạt động (check IP)
 * 2. TRUY CẬP LINK với proxy đã kết nối
 * 3. PHÁT HIỆN CAPTCHA → DỪNG LẠI
 * 4. GIẢI CAPTCHA hoàn tất
 * 5. TIẾP TỤC CRAWL dữ liệu
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';

// =============================================================================
// CONFIGURATION
// =============================================================================

const TIKTOK_SHOP_URL = 'https://vm.tiktok.com/ZTHnhmN6d3fAG-aJavt/';
const HMCAPTCHA_API_KEY = '57c29b7fde6f9b04ba13a65f1e92ba5d';

// PROXY CONFIG - NEW PROXY
const PROXY_STRING = '135.148.11.203:31280:PUS89186:PrX7CMv2';

// =============================================================================
// STEP 1: PARSE PROXY
// =============================================================================

function parseProxy(proxyStr) {
  if (!proxyStr) return null;
  
  const parts = proxyStr.split(':');
  if (parts.length >= 4) {
    return {
      host: parts[0],
      port: parseInt(parts[1]),
      username: parts[2],
      password: parts.slice(3).join(':') // Handle passwords with ':'
    };
  }
  return null;
}

function buildProxyUrl(config) {
  if (!config) return null;
  
  const auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}`;
  return `http://${auth}@${config.host}:${config.port}`;
}

function buildProxyAgent(config) {
  if (!config) return null;
  
  const proxyUrl = buildProxyUrl(config);
  return new HttpsProxyAgent(proxyUrl, {
    rejectUnauthorized: false
  });
}

// =============================================================================
// STEP 2: VERIFY PROXY HOẠT ĐỘNG
// =============================================================================

async function verifyProxy(proxyConfig) {
  if (!proxyConfig) {
    console.log('⚠️  No proxy configured - will connect directly');
    return { working: true, ip: 'direct' };
  }
  
  console.log(`\n🔌 STEP 1: Kết nối proxy ${proxyConfig.host}:${proxyConfig.port}`);
  console.log(`   Username: ${proxyConfig.username}`);
  
  const proxyAgent = buildProxyAgent(proxyConfig);
  
  try {
    // Test 1: Check IP through proxy
    console.log('   Testing IP check...');
    const ipResponse = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: proxyAgent,
      timeout: 15000
    });
    
    const proxyIp = ipResponse.data.ip;
    console.log(`   ✅ Proxy IP: ${proxyIp}`);
    
    // Test 2: Check if proxy can access TikTok
    console.log('   Testing TikTok access...');
    const tiktokResponse = await axios.get('https://www.tiktok.com', {
      httpsAgent: proxyAgent,
      timeout: 15000,
      validateStatus: () => true // Accept any status
    });
    
    console.log(`   ✅ TikTok response: ${tiktokResponse.status}`);
    
    if (tiktokResponse.status === 407) {
      throw new Error('Proxy authentication failed (407)');
    }
    
    return { 
      working: true, 
      ip: proxyIp,
      tiktokStatus: tiktokResponse.status 
    };
    
  } catch (error) {
    console.error(`   ❌ Proxy verification FAILED: ${error.message}`);
    return { working: false, error: error.message };
  }
}

// =============================================================================
// STEP 3: DETECT & SOLVE CAPTCHA
// =============================================================================

async function detectCaptcha(page) {
  console.log('\n🔍 STEP 3: Phát hiện CAPTCHA...');
  
  const captchaSelectors = [
    'img.verify_img_slide',
    'img.secsdk-captcha-img',
    'canvas[id*="captcha"]',
    'img[alt*="captcha"]',
    'img[src*="captcha"]',
    'div.captcha_verify_img_slide img',
    '#captcha-verify img',
    'img.verify-img',
    'img[class*="slide"]',
    'img[class*="puzzle"]'
  ];

  for (const selector of captchaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const box = await element.boundingBox();
        if (box && box.width >= 200 && box.height >= 100) {
          console.log(`   ✅ Tìm thấy CAPTCHA: ${selector}`);
          console.log(`   📐 Size: ${Math.round(box.width)}x${Math.round(box.height)}px`);
          return { found: true, element, selector };
        }
      }
    } catch (err) {
      continue;
    }
  }

  console.log('   ℹ️  Không phát hiện CAPTCHA');
  return { found: false };
}

async function solveCaptcha(page, captchaInfo, apiKey) {
  console.log('\n⏸️  STEP 4: DỪNG LẠI - Bắt đầu giải CAPTCHA...');
  
  // Take screenshot
  const screenshotBuffer = await captchaInfo.element.screenshot();
  const timestamp = Date.now();
  const screenshotPath = `debug/captcha_${timestamp}.png`;
  
  if (!fs.existsSync('debug')) {
    fs.mkdirSync('debug');
  }
  
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log(`   📸 Screenshot saved: ${screenshotPath}`);
  console.log(`   📦 Size: ${(screenshotBuffer.length / 1024).toFixed(2)} KB`);

  // Send to hmcaptcha.com
  const base64Image = screenshotBuffer.toString('base64');
  
  try {
    console.log('   🤖 Gửi đến hmcaptcha.com API...');
    
    const response = await axios.post('https://hmcaptcha.com/api/recognition/v1', {
      Type: 'ALL_CAPTCHA_SLIDE',
      Image: base64Image
    }, {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('   📬 API Response:', JSON.stringify(response.data, null, 2));

    if (response.data && typeof response.data.offset === 'number') {
      const offset = response.data.offset;
      console.log(`   ✅ CAPTCHA đã giải! Offset: ${offset}px`);
      
      // Apply solution
      await applyCaptchaSolution(page, offset);
      
      return { solved: true, offset };
    } else {
      console.error('   ❌ Không thể giải CAPTCHA:', response.data);
      return { solved: false, reason: 'Cannot solve' };
    }
  } catch (error) {
    console.error('   ❌ Lỗi khi giải CAPTCHA:', error.response?.data || error.message);
    return { solved: false, error: error.message };
  }
}

async function applyCaptchaSolution(page, offset) {
  console.log(`   🎯 Áp dụng giải pháp: di chuyển ${offset}px`);
  
  const sliderSelectors = [
    '.secsdk_captcha_slider_btn',
    '.captcha-slider-btn',
    'button[class*="slider"]',
    'div[class*="slider"]'
  ];
  
  for (const selector of sliderSelectors) {
    try {
      const slider = await page.$(selector);
      if (slider) {
        const box = await slider.boundingBox();
        
        // Drag slider
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + offset, box.y + box.height / 2, { steps: 25 });
        await page.mouse.up();
        
        console.log(`   ✅ Slider đã di chuyển (selector: ${selector})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
      }
    } catch (err) {
      continue;
    }
  }
  
  console.log('   ⚠️  Không tìm thấy slider để di chuyển');
}

// =============================================================================
// STEP 5: CRAWL DATA
// =============================================================================

async function crawlProductData(page) {
  console.log('\n📦 STEP 5: CRAWL dữ liệu sản phẩm...');
  
  try {
    const productData = await page.evaluate(() => {
      const data = {
        title: null,
        price: null,
        sold: null,
        rating: null,
        shop: null,
        hasContent: false
      };
      
      // Title
      const titleSelectors = [
        'h1[data-e2e="product-title"]',
        'h1[class*="title"]',
        'h1'
      ];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          data.title = el.textContent.trim();
          break;
        }
      }
      
      // Price
      const priceSelectors = [
        '[data-e2e="product-price"]',
        '[class*="price"]',
        'span[class*="Price"]'
      ];
      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          data.price = el.textContent.trim();
          break;
        }
      }
      
      // Sold
      const soldSelectors = [
        '[data-e2e="product-sold"]',
        '[class*="sold"]',
        'span[class*="Sold"]'
      ];
      for (const sel of soldSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          data.sold = el.textContent.trim();
          break;
        }
      }
      
      // Check if page has content
      data.hasContent = document.body.innerText.length > 1000;
      
      return data;
    });

    console.log('   ✅ Dữ liệu đã crawl:');
    console.log('   ' + JSON.stringify(productData, null, 6).replace(/\n/g, '\n   '));
    
    return productData;
    
  } catch (error) {
    console.error('   ❌ Lỗi khi crawl:', error.message);
    return null;
  }
}

// =============================================================================
// MAIN WORKFLOW
// =============================================================================

async function runWorkflow() {
  console.log('='.repeat(70));
  console.log('🛍️  TikTok Shop Crawler - CORRECT WORKFLOW');
  console.log('='.repeat(70));
  console.log(`\n📍 Target URL: ${TIKTOK_SHOP_URL}`);
  
  // Parse proxy
  const proxyConfig = parseProxy(PROXY_STRING);
  
  // STEP 1-2: Verify proxy
  const proxyStatus = await verifyProxy(proxyConfig);
  
  if (!proxyStatus.working) {
    console.error('\n❌ WORKFLOW STOPPED: Proxy không hoạt động!');
    console.log('💡 Giải pháp:');
    console.log('   1. Kiểm tra proxy credentials trong PROXY_STRING');
    console.log('   2. Verify proxy trên dashboard webshare.io');
    console.log('   3. Thử proxy khác hoặc set PROXY_STRING = null để test trực tiếp\n');
    return;
  }
  
  console.log(`\n✅ PROXY VERIFIED - IP: ${proxyStatus.ip}`);
  console.log('   Proxy sẽ duy trì trong suốt quá trình crawl\n');
  
  // STEP 2: Launch browser with proxy
  console.log('🚀 STEP 2: Khởi động browser với proxy...');
  
  const launchOptions = {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  };

  // Configure proxy in browser
  if (proxyConfig) {
    launchOptions.args.push(`--proxy-server=http://${proxyConfig.host}:${proxyConfig.port}`);
    console.log(`   ✅ Browser proxy: ${proxyConfig.host}:${proxyConfig.port}`);
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // Authenticate proxy
  if (proxyConfig) {
    await page.authenticate({
      username: proxyConfig.username,
      password: proxyConfig.password
    });
    console.log('   ✅ Proxy authentication configured');
  }

  try {
    // Navigate to TikTok Shop
    console.log(`\n🌐 STEP 2B: Truy cập link với proxy...`);
    const response = await page.goto(TIKTOK_SHOP_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const status = response.status();
    const finalUrl = page.url();
    
    console.log(`   Status: ${status}`);
    console.log(`   Final URL: ${finalUrl.substring(0, 100)}...`);

    // Check for error page
    if (finalUrl.includes('chrome-error://')) {
      throw new Error('Browser error page - Proxy connection failed');
    }

    // Wait for content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // STEP 3-4: Detect & Solve CAPTCHA
    const captchaInfo = await detectCaptcha(page);
    
    if (captchaInfo.found) {
      const solveResult = await solveCaptcha(page, captchaInfo, HMCAPTCHA_API_KEY);
      
      if (!solveResult.solved) {
        console.error('\n❌ WORKFLOW STOPPED: Không thể giải CAPTCHA');
        
        // Save debug info
        await page.screenshot({ path: `debug/captcha_failed_${Date.now()}.png`, fullPage: true });
        console.log('📸 Debug screenshot saved');
        
        await browser.close();
        return;
      }
      
      console.log('\n✅ CAPTCHA đã giải xong - Tiếp tục workflow...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // STEP 5: Crawl data
    const productData = await crawlProductData(page);
    
    if (productData && productData.hasContent) {
      console.log('\n✅ WORKFLOW HOÀN THÀNH!');
      
      // Save results
      const result = {
        url: TIKTOK_SHOP_URL,
        finalUrl: finalUrl,
        proxyUsed: proxyStatus.ip,
        captchaSolved: captchaInfo.found,
        data: productData,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(`debug/result_${Date.now()}.json`, JSON.stringify(result, null, 2));
      console.log('💾 Results saved to debug/result_*.json');
      
    } else {
      console.error('\n⚠️  WORKFLOW INCOMPLETE: Không crawl được dữ liệu');
    }

    // Save final screenshot
    await page.screenshot({ path: `debug/final_${Date.now()}.png`, fullPage: true });
    console.log('📸 Final screenshot saved');

  } catch (error) {
    console.error(`\n❌ WORKFLOW ERROR: ${error.message}`);
    await page.screenshot({ path: `debug/error_${Date.now()}.png` }).catch(() => {});
    
  } finally {
    console.log('\n🔒 Closing browser...');
    await browser.close();
    console.log('✅ Done!\n');
  }
}

// =============================================================================
// RUN
// =============================================================================

runWorkflow().catch(console.error);
