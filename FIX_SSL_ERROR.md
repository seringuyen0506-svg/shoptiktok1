# Fix SSL Error - ERR_SSL_VERSION_OR_CIPHER_MISMATCH

## Vấn đề
```
net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH at https://vm.tiktok.com/...
```

Lỗi này xảy ra khi:
- Proxy không hỗ trợ đúng SSL/TLS protocol
- Certificate validation fail
- Cipher mismatch giữa browser và server

## Giải pháp đã implement

### 1. Ignore HTTPS Errors
```javascript
const launchOptions = {
  headless: 'new',
  ignoreHTTPSErrors: true, // ⭐ Bỏ qua SSL errors
  args: [...]
};
```

### 2. Certificate Bypass Args
```javascript
args: [
  '--ignore-certificate-errors',           // ⭐ Ignore cert errors
  '--ignore-certificate-errors-spki-list', // ⭐ Ignore cert validation
  '--disable-web-security',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage'
]
```

### 3. Real Browser Headers
```javascript
// User Agent
await page.setUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
);

// Extra Headers
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
});
```

### 4. Retry Logic với Fallback
```javascript
// Try networkidle2 first (đợi network hoàn thành)
await page.goto(url, { 
  waitUntil: 'networkidle2',
  timeout: 60000 
});

// Nếu fail, retry với domcontentloaded (nhanh hơn)
await page.goto(url, { 
  waitUntil: 'domcontentloaded',
  timeout: 30000 
});
```

## Kết quả
✅ Bypass SSL errors hoàn toàn
✅ Accept invalid certificates
✅ Retry logic tự động (2 lần)
✅ Fallback từ networkidle2 → domcontentloaded

## Test
1. Start servers
2. Paste link có proxy: `https://vm.tiktok.com/ZTHnhmkJ47q6e-iYZNb/`
3. Xem log - không còn SSL error

## Notes
- `ignoreHTTPSErrors: true` là KEY để bypass SSL
- `--ignore-certificate-errors` bổ sung thêm layer security bypass
- Retry logic giúp xử lý network instability
- `networkidle2` tốt cho crawling (đợi API complete)
- `domcontentloaded` tốt cho trang render nhanh
