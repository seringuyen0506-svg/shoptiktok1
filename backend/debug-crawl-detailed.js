import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const URL = 'https://vm.tiktok.com/ZTHnhmN6d3fAG-aJavt/';
const PROXY = 'p.webshare.io:80:ppuozozl-rotate:c8iqnclktjv9';

// Parse proxy helper
function parseProxy(proxyStr) {
  const parts = proxyStr.split(':');
  return {
    host: parts[0],
    port: parts[1],
    username: parts[2],
    password: parts.slice(3).join(':')
  };
}

async function debugCrawl() {
  console.log('🔍 DEBUG CRAWL - Phân tích chi tiết\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const parsed = parseProxy(PROXY);
  console.log('1️⃣ PROXY CONFIGURATION');
  console.log(`   Host: ${parsed.host}:${parsed.port}`);
  console.log(`   Username: ${parsed.username}`);
  console.log(`   Password: ${parsed.password}`);
  console.log('');
  
  console.log('2️⃣ LAUNCHING BROWSER...');
  const browser = await puppeteer.launch({
    headless: false, // Xem browser để debug
    args: [
      `--proxy-server=${parsed.host}:${parsed.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors'
    ]
  });
  
  const page = await browser.newPage();
  
  console.log('3️⃣ AUTHENTICATING PROXY...');
  await page.authenticate({
    username: parsed.username,
    password: parsed.password
  });
  console.log('   ✓ Proxy authenticated');
  console.log('');
  
  console.log('4️⃣ NAVIGATING TO URL...');
  console.log(`   Target: ${URL}`);
  console.log('   Waiting for page load...');
  
  try {
    const response = await page.goto(URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log(`   ✓ Navigation complete (${response.status()})`);
    console.log(`   Final URL: ${page.url()}`);
    console.log('');
    
    // Wait a bit for redirects
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('5️⃣ PAGE ANALYSIS');
    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      return {
        url: window.location.href,
        title: document.title,
        bodyLength: document.body.innerHTML.length,
        textLength: bodyText.length,
        textPreview: bodyText.substring(0, 500),
        hasCanvas: document.querySelectorAll('canvas').length,
        hasIframes: document.querySelectorAll('iframe').length,
        hasCaptchaWord: /captcha|verify|slide|rotate|challenge/i.test(bodyText)
      };
    });
    
    console.log(`   Current URL: ${pageInfo.url}`);
    console.log(`   Page Title: ${pageInfo.title}`);
    console.log(`   HTML Size: ${pageInfo.bodyLength} chars`);
    console.log(`   Text Size: ${pageInfo.textLength} chars`);
    console.log(`   Canvas elements: ${pageInfo.hasCanvas}`);
    console.log(`   Iframe elements: ${pageInfo.hasIframes}`);
    console.log(`   CAPTCHA keywords found: ${pageInfo.hasCaptchaWord ? 'YES ⚠️' : 'NO'}`);
    console.log('');
    
    if (pageInfo.hasCaptchaWord) {
      console.log('⚠️  CAPTCHA DETECTED!');
      console.log('   Text preview:');
      console.log('   ' + pageInfo.textPreview.substring(0, 200).replace(/\n/g, ' '));
      console.log('');
    }
    
    console.log('6️⃣ LOOKING FOR CAPTCHA ELEMENTS...');
    const captchaSelectors = [
      'img[src*="captcha"]',
      'img[alt*="captcha"]',
      'canvas[class*="captcha"]',
      '[class*="captcha"] img',
      '[class*="captcha"] canvas',
      'img.secsdk-captcha-img',
      'canvas.secsdk-captcha-canvas',
      '.captcha_verify_img_slide img',
      '[class*="verify"] img'
    ];
    
    let foundSelector = null;
    let elementInfo = null;
    
    for (const sel of captchaSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          foundSelector = sel;
          const box = await el.boundingBox();
          elementInfo = box;
          console.log(`   ✓ Found: ${sel}`);
          if (box) {
            console.log(`     Size: ${Math.round(box.width)}x${Math.round(box.height)}px`);
            console.log(`     Position: (${Math.round(box.x)}, ${Math.round(box.y)})`);
          }
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!foundSelector) {
      console.log('   ❌ No CAPTCHA element found with standard selectors');
      console.log('');
      
      console.log('7️⃣ CHECKING ALL IMAGES ON PAGE...');
      const allImages = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.map(img => ({
          src: img.src.substring(0, 100),
          alt: img.alt,
          className: img.className,
          width: img.offsetWidth,
          height: img.offsetHeight
        })).filter(i => i.width > 50 && i.height > 50);
      });
      
      console.log(`   Found ${allImages.length} images (size >50px):`);
      allImages.slice(0, 5).forEach((img, i) => {
        console.log(`   ${i+1}. ${img.width}x${img.height}px - ${img.src}`);
        if (img.className) console.log(`      class: ${img.className}`);
      });
      console.log('');
      
      console.log('8️⃣ CHECKING ALL CANVASES...');
      const allCanvases = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        return canvases.map(c => ({
          className: c.className,
          width: c.offsetWidth,
          height: c.offsetHeight
        }));
      });
      
      console.log(`   Found ${allCanvases.length} canvas elements:`);
      allCanvases.forEach((c, i) => {
        console.log(`   ${i+1}. ${c.width}x${c.height}px - class: ${c.className || '(none)'}`);
      });
    }
    
    console.log('');
    console.log('9️⃣ SAVING SCREENSHOTS...');
    await page.screenshot({ path: 'debug/debug_full_page.png', fullPage: true });
    console.log('   ✓ Saved: debug/debug_full_page.png (full page)');
    
    await page.screenshot({ path: 'debug/debug_viewport.png' });
    console.log('   ✓ Saved: debug/debug_viewport.png (viewport)');
    
    if (foundSelector && elementInfo) {
      try {
        const element = await page.$(foundSelector);
        await element.screenshot({ path: 'debug/debug_captcha_element.png' });
        console.log('   ✓ Saved: debug/debug_captcha_element.png (CAPTCHA element)');
      } catch (e) {
        console.log('   ⚠️ Could not capture CAPTCHA element');
      }
    }
    
    console.log('');
    console.log('🔟 SAVING HTML...');
    const html = await page.content();
    fs.writeFileSync('debug/debug_page.html', html);
    console.log(`   ✓ Saved: debug/debug_page.html (${html.length} chars)`);
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DEBUG COMPLETE');
    console.log('');
    console.log('📁 Check these files:');
    console.log('   - debug/debug_full_page.png');
    console.log('   - debug/debug_viewport.png');
    console.log('   - debug/debug_page.html');
    if (foundSelector) {
      console.log('   - debug/debug_captcha_element.png');
    }
    
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (error) {
    console.log('');
    console.log('❌ ERROR:', error.message);
    console.log('');
    console.log('🔍 Error details:');
    console.log(`   Type: ${error.name}`);
    console.log(`   Message: ${error.message}`);
    
    if (error.message.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
      console.log('');
      console.log('💡 Vấn đề: PROXY KHÔNG HOẠT ĐỘNG');
      console.log('   - Proxy không thể tạo HTTPS tunnel');
      console.log('   - Proxy có thể đã hết hạn/blocked');
      console.log('   - Thử proxy khác hoặc không dùng proxy');
    } else if (error.message.includes('ERR_CONNECTION_RESET')) {
      console.log('');
      console.log('💡 Vấn đề: PROXY CONNECTION RESET');
      console.log('   - Proxy từ chối kết nối');
      console.log('   - Credentials có thể sai');
      console.log('   - IP bị ban bởi proxy provider');
    }
  }
  
  await browser.close();
}

debugCrawl().catch(console.error);
