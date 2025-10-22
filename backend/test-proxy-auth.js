import puppeteer from 'puppeteer';

const PROXY = '43.159.20.117:12233:user-ZP85NKvw-region-us-sessid-UUo9s9kd-sesstime-1:SgcjjxXh';

// Parse proxy
function parseProxy(proxyStr) {
  const parts = proxyStr.split(':');
  const host = parts[0];
  const port = parts[1];
  const username = parts[2];
  const password = parts.slice(3).join(':');
  return { host, port, username, password };
}

async function testProxy() {
  console.log('🔍 Testing Proxy Authentication\n');
  
  const parsed = parseProxy(PROXY);
  console.log('Parsed proxy:', {
    host: parsed.host,
    port: parsed.port,
    username: parsed.username,
    password: parsed.password
  });
  
  console.log('\n📡 Launching browser with proxy...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--proxy-server=${parsed.host}:${parsed.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors'
    ]
  });
  
  const page = await browser.newPage();
  
  // Authenticate
  await page.authenticate({
    username: parsed.username,
    password: parsed.password
  });
  
  console.log('✓ Authentication set\n');
  
  // Test 1: Simple HTTP site
  console.log('Test 1: Loading http://example.com ...');
  try {
    await page.goto('http://example.com', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ HTTP site loaded successfully!\n');
  } catch (e) {
    console.log('❌ HTTP site failed:', e.message, '\n');
  }
  
  // Test 2: HTTPS site (requires CONNECT tunnel)
  console.log('Test 2: Loading https://httpbin.org/ip ...');
  try {
    await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle2', timeout: 30000 });
    const content = await page.content();
    console.log('✅ HTTPS site loaded!');
    console.log('IP Info:', content.includes('origin') ? content : 'No IP data');
    console.log();
  } catch (e) {
    console.log('❌ HTTPS site failed:', e.message, '\n');
  }
  
  // Test 3: TikTok
  console.log('Test 3: Loading https://www.tiktok.com ...');
  try {
    await page.goto('https://www.tiktok.com', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ TikTok loaded!\n');
  } catch (e) {
    console.log('❌ TikTok failed:', e.message, '\n');
  }
  
  await browser.close();
  console.log('Done!');
}

testProxy().catch(console.error);
