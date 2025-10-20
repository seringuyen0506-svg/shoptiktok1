# 🧪 TikTok Crawler Test Workflow

## 📋 Overview

Complete test workflow để crawl danh sách TikTok links với:
- ✅ Proxy verification
- ✅ CAPTCHA solving (2Captcha/CapSolver)
- ✅ Batch processing
- ✅ Progress tracking
- ✅ Export CSV/JSON results

## 🚀 Quick Start

### 1. Test Single Link (Quick Test)
```bash
cd backend
node quick-test.js "https://www.tiktok.com/shop/pdp/1731808374866153635"
```

### 2. Run Full Workflow (All Links)
```bash
cd backend
node test-workflow.js
```

## ⚙️ Configuration

Edit `test-config.json`:

```json
{
  "proxy": {
    "host": "p.webshare.io",
    "port": "80",
    "username": "ppuozozl-rotate",
    "password": "c8iqnclktjv9"
  },
  "captcha": {
    "enabled": true,
    "provider": "2captcha",  // hoặc "capsolver"
    "apiKey": "YOUR_API_KEY_HERE"
  },
  "crawler": {
    "timeout": 60000,
    "headless": false,  // true = chạy ẩn, false = xem browser
    "batchSize": 3,     // Số links crawl cùng lúc
    "retryFailed": false,
    "maxRetries": 1
  }
}
```

## 📊 Workflow Steps

### Step 1: Proxy Check ✅
- Kết nối đến proxy
- Verify IP address
- Check location & ISP
- Warning nếu là datacenter IP

### Step 2: Browser Setup 🌐
- Launch Puppeteer với Stealth plugin
- Apply US browser fingerprint
- Set timezone UTC-5 (Eastern Time)
- Anti-detection measures

### Step 3: API Interception 📡
- Listen cho TikTok API responses
- Capture `/api/shop/pdp_desktop/page_data`
- Extract product & shop data from API

### Step 4: CAPTCHA Handling 🔒
- Detect CAPTCHA on page
- Send to 2Captcha/CapSolver
- Wait for solution
- Auto-submit solution

### Step 5: Data Extraction 📦
Priority order:
1. **API Data** (Primary) - From intercepted responses
2. **DOM Extraction** (Fallback) - From HTML selectors
3. **JSON Scripts** (Last resort) - From `<script>` tags

### Step 6: Export Results 💾
- JSON file: `test-results.json`
- CSV file: `test-results.csv`
- Screenshots: `screenshots/` folder

## 📁 Output Files

### test-results.json
```json
[
  {
    "link": "https://www.tiktok.com/shop/pdp/...",
    "status": "success",
    "productName": "Cute Christmas Sweatshirt",
    "productSold": "1.2k",
    "shopName": "Oak Haven Apparel",
    "shopSold": "50k",
    "error": null,
    "timestamp": "2025-10-20T10:30:00.000Z"
  }
]
```

### test-results.csv
```
Link,Status,Product Name,Product Sold,Shop Name,Shop Sold,Error,Timestamp
"https://...",success,"Cute Christmas Sweatshirt","1.2k","Oak Haven Apparel","50k","",2025-10-20T10:30:00.000Z
```

## 📈 Status Codes

| Status | Meaning | Action Needed |
|--------|---------|---------------|
| `success` | ✅ Data extracted successfully | None |
| `geo_restricted` | 🌍 Error code 23002102 | Use residential proxy |
| `captcha_blocked` | 🔒 CAPTCHA not solved | Add CAPTCHA API key |
| `error` | ❌ Network/timeout error | Check proxy/internet |
| `no_data` | 📭 Page loaded but no data | Check selectors |

## 🔧 CAPTCHA Setup

### Option 1: 2Captcha
1. Register at https://2captcha.com
2. Get API key from dashboard
3. Add to config:
```json
{
  "captcha": {
    "provider": "2captcha",
    "apiKey": "YOUR_2CAPTCHA_KEY",
    "enabled": true
  }
}
```

### Option 2: CapSolver
1. Register at https://capsolver.com
2. Get API key
3. Add to config:
```json
{
  "captcha": {
    "provider": "capsolver",
    "apiKey": "YOUR_CAPSOLVER_KEY",
    "enabled": true
  }
}
```

## ⚠️ Common Issues

### Issue 1: Geo-restriction (23002102)
**Symptom:** All products return `geo_restricted` status

**Solutions:**
1. ✅ Use **residential proxy** (not datacenter)
2. ✅ Try mobile proxy providers
3. ✅ Rotate proxy sessions frequently

**Check proxy type:**
```bash
curl --proxy your-proxy ipinfo.io/org
```
- ❌ Bad: "DigitalOcean", "Amazon", "Google Cloud"
- ✅ Good: "Comcast", "Verizon", "AT&T"

### Issue 2: CAPTCHA Not Solving
**Symptom:** Status `captcha_blocked`

**Solutions:**
1. Check CAPTCHA API key is valid
2. Check CAPTCHA balance: https://2captcha.com/api/balance
3. Enable in config: `captcha.enabled = true`

### Issue 3: No Data Extracted
**Symptom:** Status `no_data`

**Solutions:**
1. Check screenshots in `screenshots/` folder
2. Page may be geo-blocked (not loading data)
3. TikTok may have changed page structure

## 📊 Performance Tips

### Optimize Batch Size
```json
{
  "crawler": {
    "batchSize": 3  // Start with 3, increase if stable
  }
}
```
- Small (1-3): Slower but more stable
- Medium (5-10): Balanced
- Large (15+): Faster but may get rate-limited

### Reduce Timeout
```json
{
  "crawler": {
    "timeout": 30000  // 30s instead of 60s
  }
}
```

### Headless Mode
```json
{
  "crawler": {
    "headless": true  // Faster, uses less resources
  }
}
```

## 🧪 Testing Commands

### Test proxy only
```bash
cd backend
node -e "import('https-proxy-agent').then(m => { const agent = new m.HttpsProxyAgent('http://ppuozozl-rotate:c8iqnclktjv9@p.webshare.io:80'); import('axios').then(a => a.default.get('https://ipinfo.io/json', {httpsAgent: agent}).then(r => console.log(r.data))); })"
```

### Test single link without CAPTCHA
```bash
cd backend
node quick-test.js "https://www.tiktok.com/shop/pdp/1731808374866153635"
```

### Test first 5 links only
Edit `test-workflow.js` line 92:
```javascript
const TEST_LINKS = [ /* ... */ ].slice(0, 5);
```

## 📞 Support

### Datacenter Proxy Issue
Nếu proxy hiện tại là datacenter (webshare.io), recommend:
- Bright Data Residential: https://brightdata.com
- Smartproxy: https://smartproxy.com
- Oxylabs: https://oxylabs.io

### CAPTCHA Issues
- 2Captcha support: https://2captcha.com/support
- CapSolver docs: https://docs.capsolver.com

## 📝 Notes

1. **Browser mở 30s** sau mỗi test để bạn inspect
2. **Screenshots** tự động save vào `screenshots/` folder
3. **Progress** hiển thị real-time trong console
4. **Retry logic** có thể enable trong config nếu cần

---

Made with ❤️ for TikTok Shop crawling
