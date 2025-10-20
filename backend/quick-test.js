import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

puppeteer.use(StealthPlugin());

const CONFIG = {
  proxy: {
    host: 'p.webshare.io',
    port: '80',
    username: 'ppuozozl-rotate',
    password: 'c8iqnclktjv9'
  }
};

async function testSingleLink() {
  // Lấy link từ command line argument
  const testLink = process.argv[2] || 'https://www.tiktok.com/shop/pdp/1731808374866153635';
  
  console.log('\n🧪 QUICK TEST - Single Link Crawler');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Check proxy
  console.log('🔍 Step 1: Testing proxy...');
  const proxyUrl = `http://${CONFIG.proxy.username}:${CONFIG.proxy.password}@${CONFIG.proxy.host}:${CONFIG.proxy.port}`;
  
  try {
    const response = await axios.get('https://ipinfo.io/json', {
      httpsAgent: new HttpsProxyAgent(proxyUrl),
      timeout: 15000,
      validateStatus: () => true
    });
    
    if (response.status !== 200) {
      throw new Error(`Proxy returned status ${response.status}`);
    }
    
    console.log(`✅ Proxy working!`);
    console.log(`   IP: ${response.data.ip || 'N/A'}`);
    console.log(`   Location: ${response.data.city || 'N/A'}, ${response.data.country || 'N/A'}`);
    console.log(`   ISP: ${response.data.org || 'N/A'}`);
    
    // Warning for datacenter
    const isDC = response.data.org && (
      response.data.org.toLowerCase().includes('digitalocean') ||
      response.data.org.toLowerCase().includes('amazon') ||
      response.data.org.toLowerCase().includes('google') ||
      response.data.org.toLowerCase().includes('ovh')
    );
    
    if (isDC) {
      console.log('⚠️  WARNING: Datacenter IP - TikTok may block this!\n');
    }
  } catch (error) {
    console.error('❌ Proxy failed:', error.message);
    process.exit(1);
  }
  
  // 2. Launch browser
  console.log('\n🌐 Step 2: Launching browser with proxy...');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--proxy-server=${CONFIG.proxy.host}:${CONFIG.proxy.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      '--window-size=1400,900'
    ],
    ignoreHTTPSErrors: true
  });
  
  const page = await browser.newPage();
  
  // Authenticate proxy
  await page.authenticate({
    username: CONFIG.proxy.username,
    password: CONFIG.proxy.password
  });
  
  console.log('✅ Browser launched\n');
  
  // 3. Set headers
  console.log('🎭 Step 3: Setting US headers & fingerprint...');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  });
  
  await page.evaluateOnNewDocument(() => {
    delete Object.getPrototypeOf(navigator).webdriver;
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Date.prototype.getTimezoneOffset = () => 300; // UTC-5
  });
  
  console.log('✅ Fingerprint applied\n');
  
  // 4. API Listener
  console.log('📡 Step 4: Setting up API listener...');
  let apiData = null;
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/shop/pdp_desktop/page_data') || url.includes('/api/product/info')) {
      try {
        const json = await response.json();
        console.log('   ✓ Intercepted TikTok API!');
        console.log('   Response:', JSON.stringify(json, null, 2).substring(0, 500) + '...');
        apiData = json;
      } catch (e) {
        // Ignore
      }
    }
  });
  
  console.log('✅ Listener ready\n');
  
  // 5. Navigate
  console.log(`🚀 Step 5: Navigating to: ${testLink}`);
  console.log('   Please wait...\n');
  
  try {
    await page.goto(testLink, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log('✅ Page loaded\n');
    
    // Wait for data
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 6. Extract data
    console.log('📊 Step 6: Extracting data...\n');
    
    let result = {
      productName: '',
      productSold: '',
      shopName: '',
      shopSold: '',
      source: ''
    };
    
    // Try API first
    if (apiData) {
      console.log('   🔹 Trying API data...');
      const productInfo = apiData.data?.global_data?.product_info || 
                         apiData.data?.product_info || {};
      const shopInfo = apiData.data?.global_data?.shop_info || 
                      apiData.data?.shop_info || {};
      
      if (productInfo.error_code === 23002102) {
        console.log('   ❌ API returned error_code 23002102 (Geo-restricted)');
      } else {
        result.productName = productInfo.name || productInfo.title || '';
        result.productSold = productInfo.sold || productInfo.sales || '';
        result.shopName = shopInfo.name || shopInfo.seller_name || '';
        result.shopSold = shopInfo.sold || shopInfo.total_sold || '';
        result.source = 'API';
      }
    }
    
    // Fallback to DOM
    if (!result.productName) {
      console.log('   🔹 Trying DOM extraction...');
      
      const domData = await page.evaluate(() => {
        const getText = (selectors) => {
          for (const sel of selectors) {
            try {
              const el = document.querySelector(sel);
              if (el && el.textContent.trim()) {
                return el.textContent.trim();
              }
            } catch(e) {
              // Invalid selector, skip
            }
          }
          
          // Manual text search as fallback
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
          productName: getText([
            '[data-e2e="pdp-product-title"]',
            'h1[class*="title"]',
            'h1[class*="product"]'
          ]),
          productSold: getText([
            '[data-e2e="pdp-product-sold"]',
            'div[class*="sold"]'
          ]),
          shopName: getText([
            '[data-e2e="pdp-seller-name"]',
            'a[class*="shop"]'
          ]),
          shopSold: findByText('Món bán ra') || findByText('Items Sold') || getText([
            '[data-e2e="shop-total-sold"]'
          ])
        };
      });
      
      result.productName = domData.productName;
      result.productSold = domData.productSold;
      result.shopName = domData.shopName;
      result.shopSold = domData.shopSold;
      result.source = 'DOM';
    }
    
    // 7. Display results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`🏷️  Product Name: ${result.productName || '❌ NOT FOUND'}`);
    console.log(`📦 Product Sold: ${result.productSold || '❌ NOT FOUND'}`);
    console.log(`🏪 Shop Name: ${result.shopName || '❌ NOT FOUND'}`);
    console.log(`📊 Shop Sold: ${result.shopSold || '❌ NOT FOUND'}`);
    console.log(`📡 Data Source: ${result.source || 'NONE'}\n`);
    
    if (!result.productName) {
      console.log('⚠️  NO DATA EXTRACTED!');
      console.log('   Possible reasons:');
      console.log('   1. Geo-restriction (error_code 23002102)');
      console.log('   2. Datacenter proxy detected');
      console.log('   3. CAPTCHA blocking');
      console.log('   4. Page structure changed\n');
    } else {
      console.log('✅ SUCCESS! Data extracted successfully.\n');
    }
    
    // Screenshot
    await page.screenshot({ path: 'quick-test-result.png', fullPage: false });
    console.log('📸 Screenshot saved: quick-test-result.png\n');
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser will stay open for 30 seconds...');
    console.log('   You can manually inspect the page.\n');
    
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
  console.log('👋 Browser closed. Test complete!\n');
}

testSingleLink().catch(console.error);
