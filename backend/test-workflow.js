import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import fs from 'fs';

puppeteer.use(StealthPlugin());

// ============================================
// CONFIG - CẤU HÌNH
// ============================================
const CONFIG = {
  proxy: {
    host: 'p.webshare.io',
    port: '80',
    username: 'ppuozozl-rotate',
    password: 'c8iqnclktjv9'
  },
  captcha: {
    // Hỗ trợ 2Captcha hoặc CapSolver
    provider: '2captcha', // hoặc 'capsolver'
    apiKey: '', // Nhập API key của bạn ở đây
    enabled: true
  },
  timeout: 60000,
  headless: false, // Set false để xem browser
  batchSize: 5 // Số links crawl cùng lúc
};

// Test links từ user
const TEST_LINKS = [
  'https://vm.tiktok.com/ZTHnhaKod7Bok-Quzji/',
  'https://vm.tiktok.com/ZTHnhmhRoT5BP-1j3cW/',
  'https://vm.tiktok.com/ZTHnhaWdnJkyv-lR938/',
  'https://vm.tiktok.com/ZTHnhmkJ47q6e-iYZNb/',
  'https://vm.tiktok.com/ZTHnhmFVQaGge-ql1bj/',
  'https://vm.tiktok.com/ZTHnhmdHYKmdc-msxR7/',
  'https://vm.tiktok.com/ZTHnhmBUms5S7-nH6fr/',
  'https://vm.tiktok.com/ZTHnhmdq235eq-qIXDE/',
  'https://vm.tiktok.com/ZTHnhmN6d3fAG-aJavt/',
  'https://vm.tiktok.com/ZTHnhactSKtWB-STeVB/',
  'https://vm.tiktok.com/ZTHnhmLdj1ft3-dGSZx/',
  'https://vm.tiktok.com/ZTHnhaw8jCpPG-ZwVyg/',
  'https://vm.tiktok.com/ZTHnhatdtYvUL-0VZ1q/',
  'https://vm.tiktok.com/ZTHnhm8k5HeC8-mQ6pn/',
  'https://vm.tiktok.com/ZTHnhme8u5vR1-4JDbJ/',
  'https://vm.tiktok.com/ZTHnhaXhEyL5v-yGLeB/',
  'https://vm.tiktok.com/ZTHnhacPEUYW7-ENRYo/',
  'https://vm.tiktok.com/ZTHnhmdqdq1MK-FtjvN/',
  'https://vm.tiktok.com/ZTHnha6UspLbL-6avZ1/',
  'https://vm.tiktok.com/ZTHnhancwjfAa-jzIvB/',
  'https://vm.tiktok.com/ZTHnhafRAeMsa-DPI0k/',
  'https://vm.tiktok.com/ZTHnhan4ta4pH-n1EWN/',
  'https://vm.tiktok.com/ZTHnhaAcLrWqw-jiHa9/',
  'https://vm.tiktok.com/ZTHnhaMRM34bp-Vt3ON/',
  'https://vm.tiktok.com/ZTHnhaBdsDUA8-Sihw0/',
  'https://vm.tiktok.com/ZTHnhay68nkbM-0n4zm/',
  'https://vm.tiktok.com/ZTHnh5GLqHBmN-sz5Iv/',
  'https://vm.tiktok.com/ZTHnha2PqT1Bb-uXe5h/',
  'https://vm.tiktok.com/ZTHnh5wkoc3nm-1TV7O/',
  'https://vm.tiktok.com/ZTHnh5gdHK7AM-jjQhe/',
  'https://vm.tiktok.com/ZTHnh5sLqb1D4-lqJSH/',
  'https://vm.tiktok.com/ZTHnh5wopMCQQ-ot1Tb/',
  'https://vm.tiktok.com/ZTHnha827ypVA-meeRs/',
  'https://vm.tiktok.com/ZTHnh5wedhaSu-6gTzv/',
  'https://vm.tiktok.com/ZTHnh5w8QptGX-BuviC/',
  'https://vm.tiktok.com/ZTHnh5Pr3xe3K-K8Qua/',
  'https://vm.tiktok.com/ZTHtvpGgT63af-LjV88/',
  'https://vm.tiktok.com/ZTHnLpwBYkCYS-KNjrB/',
  'https://vm.tiktok.com/ZTHnLs82o3XMH-tgwve/',
  'https://vm.tiktok.com/ZTHnLsMp6jrdH-gzG2I/',
  'https://vm.tiktok.com/ZTHnLGJ3eVYxw-92M5c/',
  'https://vm.tiktok.com/ZTHnLsoR75BwH-NrCAP/',
  'https://vm.tiktok.com/ZTHnLGaHCoW2R-2QQ64/',
  'https://vm.tiktok.com/ZTHnLvyBgC2Rj-3heCj/',
  'https://vm.tiktok.com/ZTHnNNB3WGmH9-ALsux/',
  'https://vm.tiktok.com/ZTHnNNu7Uoba9-wDwZr/',
  'https://vm.tiktok.com/ZTHnNNBYgj7Uo-5cm3N/',
  'https://vm.tiktok.com/ZTHnNN9oa4VyG-7dLd3/',
  'https://vm.tiktok.com/ZTHnNNQJDRfNc-PWB6D/',
  'https://vm.tiktok.com/ZTHnNNmgDvBUS-KVwM1/',
  'https://vm.tiktok.com/ZTHnNNpj873wY-w74Op/',
  'https://vm.tiktok.com/ZTHnNNq2ynFau-Qfspe/',
  'https://vm.tiktok.com/ZTHnNNnV7MHWL-6cSKr/',
  'https://vm.tiktok.com/ZTHnNNtG7RRpV-LNICb/',
  'https://vm.tiktok.com/ZTHnNNw132fS6-K9irY/',
  'https://vm.tiktok.com/ZTHnNtRguAEfw-cDCF7/',
  'https://vm.tiktok.com/ZTHnNtX9EgsS7-dHSGx/',
  'https://vm.tiktok.com/ZPHnun1NyL7J3-V4Id0/',
  'https://vm.tiktok.com/ZPHn7UJcSA9Du-QOc2o/',
  'https://vm.tiktok.com/ZTHnvH7yF1vd5-EiTHj/',
  'https://vm.tiktok.com/ZPHn3yvoVpeMX-F3eA1/',
  'https://vm.tiktok.com/ZPHn3f8TNNHEe-BTnKQ/',
  'https://vm.tiktok.com/ZPHn3fYNyfyK2-XHN2S/',
  'https://vm.tiktok.com/ZPHn3fMj5hRtF-S1F5F/',
  'https://vm.tiktok.com/ZPHn3fXT6KwhW-ozTZc/',
  'https://vm.tiktok.com/ZPHn3fpvS1B59-4hSXm/',
  'https://vm.tiktok.com/ZPHn3ftWE2Lqm-ZsfI7/',
  'https://vm.tiktok.com/ZPHn3fTeuJ91V-Fh1k9/',
  'https://vm.tiktok.com/ZPHn3fE2F5b1Y-HY9p4/',
  'https://vm.tiktok.com/ZPHn3PL3bxNbW-UPwfG/',
  'https://vm.tiktok.com/ZPHn3ar5mSSSS-9OfIj/',
  'https://vm.tiktok.com/ZPHnwwLRtH5g5-1ExyO/',
  'https://vm.tiktok.com/ZPHnwEPqpFTPD-1i60n/',
  'https://vm.tiktok.com/ZPHnwEHuhcby3-OgeeO/',
  'https://vm.tiktok.com/ZPHnwEC9QwaEn-oWnVC/',
  'https://vm.tiktok.com/ZPHnwEGaVmRBJ-7AEVR/',
  'https://www.tiktok.com/shop/pdp/1731808374866153635',
  'https://www.tiktok.com/shop/pdp/1731808216458170531',
  'https://www.tiktok.com/shop/pdp/cute-christmas-movie-watching-shirt-sweatshirt-fur-frauen/1731714475920101400',
  'https://www.tiktok.com/shop/pdp/retro-christmas-nutcracker-sweatshirt-unisex-fit-soft-fabric/1731643452134690842',
  'https://www.tiktok.com/shop/pdp/christmas-sweatshirt-by-oak-haven-apparel-cozy-holiday-pullover-cute-winter-crewneck-for-women-eco-f/1731779090052649084',
  'https://www.tiktok.com/shop/pdp/1731808408834838691',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1729424774588174723?source=ecommerce_store',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1729471837301019011?source=ecommerce_store',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1729732435931337091',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1729813167028801923?source=ecommerce_store',
  'https://www.tiktok.com/shop/pdp/sweatshirt-by-velaris-lightweight-acotar-throne-of-glass-design/1730846715702252059',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1730215247680672708',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1730215162432885700?source=ecommerce_store',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1729736657066496964',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1730332925978907588',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1731785732856844685?source=ecommerce_store',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1731814319057834523?source=ecommerce_store',
  'https://www.tiktok.com/shop/pdp/i-could-be-meaner-tee-by-trend-apparel-funny-unisex-shirt-for-all/1730880636227588948',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1731620771297595786',
  'https://www.tiktok.com/shop/pdp/mens-athletic-t-shirt-by-brand-lightweight-quick-dry-crew-neck-tops/1731706276135866762',
  'https://vm.tiktok.com/ZTH7XUcbM4PR1-qFN1R/',
  'https://www.tiktok.com/shop/pdp/coffee-weather-crewneck-sweatshirt-by-gildan-relaxed-fit-cotton-blend/1729447030344093876',
  'https://www.tiktok.com/view/product/1729449233348596433',
  'https://www.tiktok.com/view/product/1729729258566685610'
];

// ============================================
// 1. PROXY CHECKER
// ============================================
async function checkProxy() {
  console.log('\n🔍 [PROXY CHECK] Testing proxy connection...');
  
  const proxyUrl = `http://${CONFIG.proxy.username}:${CONFIG.proxy.password}@${CONFIG.proxy.host}:${CONFIG.proxy.port}`;
  
  try {
    // Test với ipinfo.io
    const response = await axios.get('https://ipinfo.io/json', {
      httpsAgent: new (await import('https-proxy-agent')).HttpsProxyAgent(proxyUrl),
      timeout: 15000,
      validateStatus: () => true
    });
    
    console.log('✅ [PROXY CHECK] Proxy is working!');
    console.log(`   📍 IP: ${response.data.ip}`);
    console.log(`   📍 Location: ${response.data.city}, ${response.data.region}, ${response.data.country}`);
    console.log(`   📍 ISP: ${response.data.org}`);
    console.log(`   📍 Timezone: ${response.data.timezone}`);
    
    // Check nếu là datacenter IP
    if (response.data.org && (
      response.data.org.toLowerCase().includes('digitalocean') ||
      response.data.org.toLowerCase().includes('amazon') ||
      response.data.org.toLowerCase().includes('google cloud') ||
      response.data.org.toLowerCase().includes('ovh') ||
      response.data.org.toLowerCase().includes('linode')
    )) {
      console.log('⚠️  [WARNING] Datacenter IP detected! TikTok may block this.');
      console.log('   💡 Recommend: Use residential or mobile proxy for better success rate');
    }
    
    return true;
  } catch (error) {
    console.error('❌ [PROXY CHECK] Failed:', error.message);
    return false;
  }
}

// ============================================
// 2. CAPTCHA SOLVER
// ============================================
async function solveCaptcha(page, siteKey) {
  if (!CONFIG.captcha.enabled || !CONFIG.captcha.apiKey) {
    console.log('⚠️  [CAPTCHA] Solver disabled or no API key');
    return null;
  }
  
  console.log('🤖 [CAPTCHA] Solving CAPTCHA...');
  
  const pageUrl = page.url();
  
  try {
    if (CONFIG.captcha.provider === '2captcha') {
      // 2Captcha API
      const createTask = await axios.post('http://2captcha.com/in.php', null, {
        params: {
          key: CONFIG.captcha.apiKey,
          method: 'userrecaptcha',
          googlekey: siteKey,
          pageurl: pageUrl,
          json: 1
        }
      });
      
      if (createTask.data.status !== 1) {
        throw new Error(createTask.data.request);
      }
      
      const taskId = createTask.data.request;
      console.log(`   Task ID: ${taskId}`);
      
      // Poll cho kết quả
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const result = await axios.get('http://2captcha.com/res.php', {
          params: {
            key: CONFIG.captcha.apiKey,
            action: 'get',
            id: taskId,
            json: 1
          }
        });
        
        if (result.data.status === 1) {
          console.log('✅ [CAPTCHA] Solved successfully!');
          return result.data.request;
        }
        
        if (result.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(result.data.request);
        }
      }
      
      throw new Error('CAPTCHA solving timeout');
      
    } else if (CONFIG.captcha.provider === 'capsolver') {
      // CapSolver API
      const createTask = await axios.post('https://api.capsolver.com/createTask', {
        clientKey: CONFIG.captcha.apiKey,
        task: {
          type: 'ReCaptchaV2TaskProxyLess',
          websiteURL: pageUrl,
          websiteKey: siteKey
        }
      });
      
      if (createTask.data.errorId !== 0) {
        throw new Error(createTask.data.errorDescription);
      }
      
      const taskId = createTask.data.taskId;
      console.log(`   Task ID: ${taskId}`);
      
      // Poll cho kết quả
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const result = await axios.post('https://api.capsolver.com/getTaskResult', {
          clientKey: CONFIG.captcha.apiKey,
          taskId: taskId
        });
        
        if (result.data.status === 'ready') {
          console.log('✅ [CAPTCHA] Solved successfully!');
          return result.data.solution.gRecaptchaResponse;
        }
        
        if (result.data.status !== 'processing') {
          throw new Error(result.data.errorDescription || 'Unknown error');
        }
      }
      
      throw new Error('CAPTCHA solving timeout');
    }
  } catch (error) {
    console.error('❌ [CAPTCHA] Failed:', error.message);
    return null;
  }
}

// ============================================
// 3. CRAWL SINGLE LINK
// ============================================
async function crawlLink(browser, link, index, total) {
  console.log(`\n📦 [${index}/${total}] Crawling: ${link}`);
  
  const page = await browser.newPage();
  let result = {
    link: link,
    status: 'pending',
    productName: '',
    productSold: '',
    shopName: '',
    shopSold: '',
    error: null,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Set US headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Anti-detection
    await page.evaluateOnNewDocument(() => {
      delete Object.getPrototypeOf(navigator).webdriver;
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      Date.prototype.getTimezoneOffset = function() { return 300; }; // UTC-5
    });
    
    // API Listener
    let apiData = null;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/shop/pdp_desktop/page_data') || url.includes('/api/product/info')) {
        try {
          const json = await response.json();
          if (json && json.data) {
            console.log('   ✓ Intercepted TikTok Shop API');
            apiData = json;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    
    // Navigate
    await page.goto(link, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeout
    });
    
    // Check for CAPTCHA
    const hasCaptcha = await page.evaluate(() => {
      return document.body.innerHTML.includes('captcha') || 
             document.body.innerHTML.includes('verify-code') ||
             document.querySelector('[data-callback]') !== null;
    });
    
    if (hasCaptcha) {
      console.log('   🔒 CAPTCHA detected!');
      
      // Tìm siteKey
      const siteKey = await page.evaluate(() => {
        const el = document.querySelector('[data-sitekey]');
        return el ? el.getAttribute('data-sitekey') : null;
      });
      
      if (siteKey && CONFIG.captcha.enabled) {
        const solution = await solveCaptcha(page, siteKey);
        if (solution) {
          // Submit CAPTCHA solution
          await page.evaluate((token) => {
            const textarea = document.querySelector('[name="g-recaptcha-response"]');
            if (textarea) {
              textarea.innerHTML = token;
              textarea.value = token;
            }
            const callback = window.___grecaptcha_cfg?.clients?.[0]?.callback;
            if (callback) callback(token);
          }, solution);
          
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        }
      } else {
        result.status = 'captcha_blocked';
        result.error = 'CAPTCHA detected but no solver configured';
        await page.close();
        return result;
      }
    }
    
    // Wait for API or DOM
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try API data first
    if (apiData) {
      console.log('   📊 Extracting from API...');
      
      const productInfo = apiData.data?.global_data?.product_info || 
                         apiData.data?.product_info || 
                         apiData.data?.productInfo || {};
      
      const shopInfo = apiData.data?.global_data?.shop_info || 
                      apiData.data?.shop_info || 
                      apiData.data?.shopInfo || {};
      
      // Check error_code
      if (productInfo.error_code === 23002102) {
        result.status = 'geo_restricted';
        result.error = 'Product not available in this region (error_code: 23002102)';
      } else {
        result.productName = productInfo.name || productInfo.title || '';
        result.productSold = productInfo.sold || productInfo.sales || '';
        result.shopName = shopInfo.name || shopInfo.seller_name || '';
        result.shopSold = shopInfo.sold || shopInfo.total_sold || '';
        result.status = 'success';
      }
    }
    
    // Fallback to DOM
    if (!result.productName && result.status !== 'geo_restricted') {
      console.log('   🔍 Extracting from DOM...');
      
      const domData = await page.evaluate(() => {
        const selectors = {
          productName: [
            '[data-e2e="pdp-product-title"]',
            'h1[class*="title"]',
            'h1[class*="product"]',
            '.product-title'
          ],
          productSold: [
            '[data-e2e="pdp-product-sold"]',
            'div[class*="sold"]'
          ],
          shopName: [
            '[data-e2e="pdp-seller-name"]',
            'a[class*="shop-name"]',
            'div[class*="seller"]'
          ],
          shopSold: [
            '[data-e2e="shop-total-sold"]'
          ]
        };
        
        const getFirst = (sels) => {
          for (const sel of sels) {
            try {
              const el = document.querySelector(sel);
              if (el) return el.textContent.trim();
            } catch(e) {
              // Invalid selector, skip
            }
          }
          return '';
        };
        
        const findByText = (text) => {
          const divs = document.querySelectorAll('div');
          for (const div of divs) {
            if (div.textContent.includes(text)) {
              return div.textContent.trim();
            }
          }
          return '';
        };
        
        return {
          productName: getFirst(selectors.productName),
          productSold: getFirst(selectors.productSold),
          shopName: getFirst(selectors.shopName),
          shopSold: findByText('Món bán ra') || findByText('Items Sold') || getFirst(selectors.shopSold)
        };
      });
      
      result.productName = domData.productName;
      result.productSold = domData.productSold;
      result.shopName = domData.shopName;
      result.shopSold = domData.shopSold;
      result.status = result.productName ? 'success' : 'no_data';
    }
    
    // Screenshot for debugging
    await page.screenshot({ 
      path: `c:\\Users\\TIEN DUNG\\Documents\\TikTokShop\\screenshots\\${index}.png`,
      fullPage: false 
    });
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    result.status = 'error';
    result.error = error.message;
  } finally {
    await page.close();
  }
  
  // Log result
  if (result.status === 'success') {
    console.log(`   ✅ SUCCESS - Product: ${result.productName.substring(0, 50)}...`);
  } else {
    console.log(`   ⚠️  ${result.status.toUpperCase()} - ${result.error || 'No data found'}`);
  }
  
  return result;
}

// ============================================
// 4. BATCH CRAWLER
// ============================================
async function runBatchCrawl() {
  console.log('\n🚀 [WORKFLOW] Starting TikTok Crawler Test Workflow');
  console.log(`   Total links: ${TEST_LINKS.length}`);
  console.log(`   Batch size: ${CONFIG.batchSize}`);
  
  // Step 1: Check proxy
  const proxyOk = await checkProxy();
  if (!proxyOk) {
    console.error('\n❌ [FATAL] Proxy check failed! Cannot continue.');
    process.exit(1);
  }
  
  // Step 2: Create screenshots folder
  const screenshotsDir = 'c:\\Users\\TIEN DUNG\\Documents\\TikTokShop\\screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  // Step 3: Launch browser
  console.log('\n🌐 [BROWSER] Launching Chrome...');
  const proxyUrl = `${CONFIG.proxy.host}:${CONFIG.proxy.port}`;
  
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      `--proxy-server=${proxyUrl}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--ignore-certificate-errors',
      '--window-size=1920,1080'
    ],
    ignoreHTTPSErrors: true
  });
  
  // Authenticate proxy
  const pages = await browser.pages();
  if (pages[0]) {
    await pages[0].authenticate({
      username: CONFIG.proxy.username,
      password: CONFIG.proxy.password
    });
  }
  
  console.log('✅ [BROWSER] Chrome launched with proxy');
  
  // Step 4: Crawl in batches
  const results = [];
  const batches = [];
  
  for (let i = 0; i < TEST_LINKS.length; i += CONFIG.batchSize) {
    batches.push(TEST_LINKS.slice(i, i + CONFIG.batchSize));
  }
  
  console.log(`\n📊 [BATCH] Processing ${batches.length} batches...`);
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 BATCH ${batchIndex + 1}/${batches.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const batchPromises = batch.map((link, idx) => {
      const globalIndex = batchIndex * CONFIG.batchSize + idx + 1;
      return crawlLink(browser, link, globalIndex, TEST_LINKS.length);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Progress summary
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status !== 'success').length;
    console.log(`\n📈 Progress: ${results.length}/${TEST_LINKS.length} | ✅ ${success} | ❌ ${failed}`);
  }
  
  await browser.close();
  
  // Step 5: Export results
  console.log('\n💾 [EXPORT] Saving results...');
  
  // JSON
  fs.writeFileSync(
    'c:\\Users\\TIEN DUNG\\Documents\\TikTokShop\\test-results.json',
    JSON.stringify(results, null, 2)
  );
  
  // CSV
  const csvHeader = 'Link,Status,Product Name,Product Sold,Shop Name,Shop Sold,Error,Timestamp\n';
  const csvRows = results.map(r => {
    const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    return [
      escape(r.link),
      escape(r.status),
      escape(r.productName),
      escape(r.productSold),
      escape(r.shopName),
      escape(r.shopSold),
      escape(r.error || ''),
      escape(r.timestamp)
    ].join(',');
  }).join('\n');
  
  fs.writeFileSync(
    'c:\\Users\\TIEN DUNG\\Documents\\TikTokShop\\test-results.csv',
    csvHeader + csvRows
  );
  
  // Step 6: Final summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 WORKFLOW COMPLETED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const stats = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    geoRestricted: results.filter(r => r.status === 'geo_restricted').length,
    captcha: results.filter(r => r.status === 'captcha_blocked').length,
    error: results.filter(r => r.status === 'error').length,
    noData: results.filter(r => r.status === 'no_data').length
  };
  
  console.log(`\n📊 STATISTICS:`);
  console.log(`   Total: ${stats.total}`);
  console.log(`   ✅ Success: ${stats.success} (${(stats.success/stats.total*100).toFixed(1)}%)`);
  console.log(`   🌍 Geo-restricted: ${stats.geoRestricted}`);
  console.log(`   🔒 CAPTCHA blocked: ${stats.captcha}`);
  console.log(`   ❌ Errors: ${stats.error}`);
  console.log(`   📭 No data: ${stats.noData}`);
  
  console.log(`\n📁 OUTPUTS:`);
  console.log(`   JSON: test-results.json`);
  console.log(`   CSV: test-results.csv`);
  console.log(`   Screenshots: screenshots/ folder`);
  
  if (stats.geoRestricted > 0) {
    console.log(`\n⚠️  GEO-RESTRICTION DETECTED!`);
    console.log(`   ${stats.geoRestricted} products returned error_code 23002102`);
    console.log(`   💡 Solutions:`);
    console.log(`      1. Use residential proxy (not datacenter)`);
    console.log(`      2. Try mobile proxy providers`);
    console.log(`      3. Use session rotation`);
  }
}

// ============================================
// RUN
// ============================================
runBatchCrawl().catch(console.error);
