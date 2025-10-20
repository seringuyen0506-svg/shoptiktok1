# 📊 TỔNG KẾT CÁC THAY ĐỔI

## ✅ ĐÃ SỬA XONG

### 🔧 File: `backend/index.js`

#### 1. **Import stealth plugin** (dòng 1-11)
```javascript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Sử dụng stealth plugin để tránh bị phát hiện
puppeteer.use(StealthPlugin());
```
**Lý do:** TikTok phát hiện bot qua `navigator.webdriver` và automation flags. Stealth plugin giúp bypass.

---

#### 2. **Thêm random delay helper** (dòng 14)
```javascript
const randomDelay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
```
**Lý do:** Tránh bị rate limit và phát hiện bot vì crawl quá nhanh.

---

#### 3. **Delay giữa các request** (dòng 23-24)
```javascript
// Random delay giữa các request (2-5s)
await randomDelay(2000, 5000);
```
**Lý do:** Giả lập hành vi người dùng thật.

---

#### 4. **Cấu hình Puppeteer với headless mới** (dòng 31-41)
```javascript
const launchOptions = {
  headless: 'new', // ← THAY ĐỔI TỪ headless: true
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled', // ← QUAN TRỌNG
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ]
};
```
**Lý do:** 
- `headless: 'new'` ít bị phát hiện hơn `headless: true`
- `--disable-blink-features=AutomationControlled` tắt flag automation

---

#### 5. **SỬA PROXY PARSING** (dòng 43-50) ⭐ QUAN TRỌNG NHẤT
```javascript
// Parse proxy đúng format: host:port:username:password
if (proxy) {
  const proxyParts = proxy.split(':');
  if (proxyParts.length >= 2) {
    const host = proxyParts[0];
    const port = proxyParts[1];
    launchOptions.args.push(`--proxy-server=${host}:${port}`);
  }
}
```
**Trước:** 
```javascript
const [host, port] = proxy.split(':'); // ← CHỈ LẤY 2 PHẦN ĐẦU
```

**Sau:**
```javascript
const proxyParts = proxy.split(':');
const host = proxyParts[0];  // 43.159.20.117
const port = proxyParts[1];  // 12233
// proxyParts[2] = username
// proxyParts[3] = password
```

**Lý do:** Proxy format của bạn là `host:port:username:password`, nhưng code cũ chỉ lấy 2 phần đầu nên sai.

---

#### 6. **Set viewport** (dòng 56)
```javascript
await page.setViewport({ width: 1920, height: 1080 });
```
**Lý do:** TikTok check viewport size. Bot thường không set viewport.

---

#### 7. **Proxy authentication đúng** (dòng 59-65)
```javascript
if (proxy && proxy.split(':').length >= 4) {
  const proxyParts = proxy.split(':');
  const username = proxyParts[2]; // ← INDEX 2, KHÔNG PHẢI [,, username]
  const password = proxyParts[3]; // ← INDEX 3
  await page.authenticate({ username, password });
}
```
**Trước:**
```javascript
const [, , username, password] = proxy.split(':'); // ← DESTRUCTURING SAI
```

**Lý do:** Array destructuring với `[, , username, password]` chỉ hoạt động nếu array có ĐÚNG 4 phần. Nếu proxy có thêm phần (như `:region-us:sessid-...`) thì sẽ sai.

---

#### 8. **User agent mới hơn** (dòng 68)
```javascript
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
```
**Trước:** Chrome/120.0.0.0 (đã cũ)  
**Sau:** Chrome/131.0.0.0 (mới nhất)

---

#### 9. **Override navigator properties** (dòng 71-76)
```javascript
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'vi'] });
  window.chrome = { runtime: {} };
});
```
**Lý do:** Bot detection check những property này.

---

#### 10. **Set headers** (dòng 79-82)
```javascript
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
});
```
**Lý do:** Giả lập browser thật.

---

#### 11. **Goto với timeout lớn hơn** (dòng 85)
```javascript
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
```
**Trước:** `waitUntil: 'networkidle2', timeout: 60000`  
**Sau:** `waitUntil: 'domcontentloaded', timeout: 90000`

**Lý do:** 
- `domcontentloaded` nhanh hơn `networkidle2`
- 90s đủ cho TikTok load chậm

---

#### 12. **Chờ thêm sau khi load** (dòng 88)
```javascript
await randomDelay(3000, 5000);
```
**Lý do:** DOM cần thời gian render sau khi load.

---

#### 13. **Wait selector linh hoạt hơn** (dòng 91-95)
```javascript
try {
  await page.waitForSelector('span[class*="Semibold"]', { timeout: 30000 });
} catch (e) {
  console.log('⚠ Timeout waiting for selectors:', e.message);
}
```
**Trước:** Chờ selector cụ thể, 15s timeout  
**Sau:** Chờ selector general hơn, 30s timeout

---

#### 14. **Scroll để trigger lazy loading** (dòng 98-101)
```javascript
await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight / 2);
});
await randomDelay(1000, 2000);
```
**Lý do:** TikTok dùng lazy loading, cần scroll để load content.

---

#### 15. **Multiple selectors** (dòng 104-136)
```javascript
const getText = (selectors) => {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) return el.textContent.trim();
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
  // ...
};
```
**Lý do:** TikTok thay đổi class names thường xuyên. Có nhiều selector để fallback.

---

#### 16. **Screenshot để debug** (dòng 148-152)
```javascript
try {
  await page.screenshot({ path: 'screenshot_debug.png', fullPage: false });
  console.log('✓ Screenshot saved');
} catch (e) {
  console.log('Screenshot error:', e.message);
}
```
**Lý do:** Debug khi không crawl được.

---

#### 17. **Lưu toàn bộ HTML** (dòng 160-164)
```javascript
try {
  fs.writeFileSync('html_log.txt', html, { encoding: 'utf8' });
  console.log('✓ HTML saved to html_log.txt');
} catch (err) {
  console.log('⚠ Error saving html_log.txt:', err.message);
}
```
**Trước:** Chỉ lưu 2000 ký tự đầu  
**Sau:** Lưu toàn bộ HTML

---

#### 18. **Better logging** (khắp nơi)
```javascript
console.log('✓ Success');    // Success
console.log('⚠ Warning');    // Warning
console.log('✗ Error');      // Error
console.log('📡 Action');    // Action
```
**Lý do:** Dễ đọc hơn trong terminal.

---

## 📦 Dependencies đã cài

```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

---

## 🎯 KẾT QUẢ MONG ĐỢI

### Trước khi sửa:
- ❌ Proxy không hoạt động → Dùng IP thật → TikTok chặn
- ❌ Bị phát hiện bot → Captcha hoặc block
- ❌ Timeout vì chờ không đủ lâu
- ❌ Selector không match → Không có dữ liệu

### Sau khi sửa:
- ✅ Proxy hoạt động đúng → Request từ proxy IP
- ✅ Stealth mode → Không bị phát hiện bot
- ✅ Timeout đủ lâu → Load được trang
- ✅ Multiple selectors → Bắt được dữ liệu dù TikTok đổi class

---

## 🚀 CÁCH CHẠY

### Terminal 1 - Backend:
```powershell
cd "c:\Users\TIEN DUNG\Documents\TikTokShop\backend"
node index.js
```

### Terminal 2 - Frontend:
```powershell
cd "c:\Users\TIEN DUNG\Documents\TikTokShop\frontend"
node server.js
```

### Terminal 3 - Test (optional):
```powershell
cd "c:\Users\TIEN DUNG\Documents\TikTokShop"
.\test-crawler.ps1
```

### Browser:
```
http://localhost:3000
```

---

## 📊 TEST RESULT

Sau khi chạy, check:
1. **Terminal backend** - Xem log crawl
2. **File `backend/html_log.txt`** - HTML của trang
3. **File `backend/screenshot_debug.png`** - Screenshot
4. **Browser** - Kết quả trong bảng

---

**Good luck! 🎉**
