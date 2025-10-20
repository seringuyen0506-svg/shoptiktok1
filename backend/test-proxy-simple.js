// Simple proxy test - No complicated dependencies
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const CONFIG = {
  proxy: {
    host: 'p.webshare.io',
    port: '80',
    username: 'ppuozozl-rotate',
    password: 'c8iqnclktjv9'
  }
};

async function testProxySimple() {
  console.log('\n🔍 SIMPLE PROXY TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📡 Launching browser with proxy...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--proxy-server=${CONFIG.proxy.host}:${CONFIG.proxy.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1400,900'
    ]
  });
  
  const page = await browser.newPage();
  
  // Authenticate
  await page.authenticate({
    username: CONFIG.proxy.username,
    password: CONFIG.proxy.password
  });
  
  console.log('✅ Browser launched with proxy auth\n');
  
  try {
    // Test 1: Check IP (try multiple services)
    console.log('Step 1: Checking IP...\n');
    
    let ipInfo = null;
    
    // Try api.ipify.org first (simpler)
    try {
      await page.goto('https://api.ipify.org?format=json', { 
        waitUntil: 'networkidle2',
        timeout: 20000 
      });
      
      const ipifyData = await page.evaluate(() => {
        try {
          return JSON.parse(document.body.textContent);
        } catch {
          return null;
        }
      });
      
      if (ipifyData && ipifyData.ip) {
        console.log(`✅ Proxy IP: ${ipifyData.ip}\n`);
        ipInfo = { ip: ipifyData.ip };
      }
    } catch (e) {
      console.log('⚠️  Could not check IP, continuing...\n');
    }
    
    // Test 2: Check if CAPTCHA solver is configured
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔒 CAPTCHA SOLVER STATUS:\n');
    
    const fs = await import('fs');
    const config = JSON.parse(fs.readFileSync('test-config.json', 'utf8'));
    
    if (config.captcha.enabled && config.captcha.apiKey && config.captcha.apiKey !== '') {
      console.log(`   ✅ CAPTCHA Solver: ENABLED`);
      console.log(`   Provider: ${config.captcha.provider}`);
      console.log(`   API Key: ${config.captcha.apiKey.substring(0, 8)}...`);
      console.log(`   Status: READY ✅\n`);
    } else {
      console.log(`   ❌ CAPTCHA Solver: NOT CONFIGURED`);
      console.log(`   Status: Will fail on CAPTCHA challenges`);
      console.log(`   Fix: Add API key to test-config.json\n`);
    }
    
    // Test 3: Try TikTok
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 Testing TikTok access...\n');
    
    await page.goto('https://www.tiktok.com/shop/pdp/1731808374866153635', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log('✅ TikTok page loaded!\n');
    
    // Check for common issues
    const pageText = await page.evaluate(() => document.body.textContent);
    const pageHtml = await page.evaluate(() => document.body.innerHTML);
    
    if (pageText.includes('captcha') || pageText.includes('verify')) {
      console.log('⚠️  CAPTCHA DETECTED on page!');
      if (!config.captcha.enabled || !config.captcha.apiKey) {
        console.log('   Action needed: Configure CAPTCHA solver\n');
      }
    } else if (pageHtml.length < 1000) {
      console.log('⚠️  Page content is very small (possible geo-restriction)');
      console.log('   This usually means TikTok detected datacenter proxy\n');
    } else {
      console.log('✅ Page loaded successfully with normal content\n');
    }
    
    // Screenshot
    await page.screenshot({ path: 'proxy-test-tiktok.png', fullPage: false });
    console.log('📸 Screenshot saved: proxy-test-tiktok.png\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 SUMMARY:\n');
    console.log(`   ${ipInfo ? '✅' : '⚠️'} Proxy: ${ipInfo ? 'Working (IP: ' + ipInfo.ip + ')' : 'Unknown'}`);
    console.log(`   ${config.captcha.enabled && config.captcha.apiKey ? '✅' : '❌'} CAPTCHA Solver: ${config.captcha.enabled && config.captcha.apiKey ? 'Configured' : 'Not configured'}`);
    console.log(`   TikTok Access: ${pageHtml.length > 1000 ? 'Success' : 'Limited (geo-block?)'}\n`);
    
    console.log('⚠️  NOTE: Proxy is datacenter type (Webshare.io)');
    console.log('   TikTok may block datacenter IPs → Use residential proxy for better results\n');
    
    console.log('Browser will stay open for 20 seconds for inspection...\n');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
  console.log('✅ Test complete!\n');
}

testProxySimple().catch(console.error);
