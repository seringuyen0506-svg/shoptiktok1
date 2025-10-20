# 🚀 Quick Start Guide - TikTok Crawler Test Workflow

## 🎯 Mục Đích
Test crawl 98 TikTok links với:
- ✅ Proxy verification
- ✅ CAPTCHA solving  
- ✅ Batch processing
- ✅ Export results

## ⚡ Chạy Ngay (3 Bước)

### Bước 1: Quick Test (1 link)
```bash
cd backend
node quick-test.js
```
**Kết quả:** Browser mở, test 1 link, screenshot saved

### Bước 2: Config CAPTCHA (Nếu cần)
Edit `backend/test-config.json`:
```json
{
  "captcha": {
    "apiKey": "YOUR_2CAPTCHA_KEY_HERE"
  }
}
```

### Bước 3: Run Full Workflow (98 links)
```bash
cd backend
node test-workflow.js
```
**Kết quả:** `test-results.json` + `test-results.csv` + `screenshots/`

## 📁 Files Quan Trọng

| File | Mục Đích | Khi Nào Dùng |
|------|----------|--------------|
| `quick-test.js` | Test 1 link nhanh | Debug, verify setup |
| `test-workflow.js` | Crawl 98 links | Production run |
| `check-proxy.js` | Check proxy type | Verify proxy quality |
| `test-config.json` | Configuration | Thay đổi settings |
| `index.js` | API server | Web UI (localhost:3000) |

## ⚙️ Cấu Hình

### Proxy Settings
```json
{
  "proxy": {
    "host": "your-proxy.com",
    "port": "80",
    "username": "user",
    "password": "pass"
  }
}
```

### CAPTCHA Settings
```json
{
  "captcha": {
    "enabled": true,
    "provider": "2captcha",     // or "capsolver"
    "apiKey": "YOUR_KEY_HERE"   // ⚠️ REQUIRED
  }
}
```

### Performance Settings
```json
{
  "crawler": {
    "batchSize": 3,      // Số links crawl cùng lúc (1-10)
    "headless": false,   // true = không hiện browser
    "timeout": 60000     // Timeout mỗi link (ms)
  }
}
```

## ⚠️ Vấn Đề Thường Gặp

### ❌ "No data extracted" - Geo-restriction
**Nguyên nhân:** Proxy datacenter bị TikTok chặn

**Giải pháp:** Đổi sang residential/mobile proxy
- Bright Data: https://brightdata.com
- Smartproxy: https://smartproxy.com  
- Proxy-Cheap: https://proxy-cheap.com

**Check proxy type:**
```bash
curl --proxy your-proxy ipinfo.io/org
```
- ❌ Bad: "DigitalOcean", "AWS", "Webshare"
- ✅ Good: "Comcast", "Verizon", "AT&T"

### 🔒 "CAPTCHA blocked"
**Nguyên nhân:** Chưa config CAPTCHA API key

**Giải pháp:**
1. Đăng ký https://2captcha.com
2. Nạp tiền ($10 minimum)
3. Copy API key vào `test-config.json`

### ⏱️ Timeout / Slow
**Giải pháp:**
- Giảm `batchSize` xuống 1-2
- Tăng `timeout` lên 90000 (90s)
- Enable `headless: true`

## 📊 Kết Quả Mong Đợi

### Với Datacenter Proxy (Hiện tại)
```
✅ Success: 0-10%
⚠️  Geo-restricted: 80-90%
🔒 CAPTCHA: 5-10%
```

### Với Residential Proxy (Recommended)
```
✅ Success: 70-90%
⚠️  Geo-restricted: 5-10%
🔒 CAPTCHA: 10-20% (auto-solved)
```

## 📁 Output Files

```
TikTokShop/
├── test-results.json       # Full data (JSON)
├── test-results.csv        # Excel-compatible  
├── screenshots/            # Debug images
│   ├── 1.png
│   ├── 2.png
│   └── ...
└── quick-test-result.png   # Quick test screenshot
```

## 🔍 Debugging

### Xem Screenshot
```bash
# Windows
start quick-test-result.png

# Or open screenshots/ folder
explorer screenshots
```

### Xem Results
```bash
# View JSON
cat test-results.json

# View CSV in Excel
start test-results.csv
```

### Check Logs
Tất cả output đều print ra console real-time:
```
📦 [1/98] Crawling: https://...
   ✓ Intercepted TikTok Shop API
   ✅ SUCCESS - Product: Christmas Sweatshirt...
```

## 📞 Support

### Documentation
- `TEST_WORKFLOW_GUIDE.md` - Chi tiết workflow
- `TEST_WORKFLOW_RESULTS.md` - Kết quả test
- `PROJECT_REVIEW_SUMMARY.md` - Tổng hợp review
- `ERROR_23002102_GEO_RESTRICTION.md` - Giải thích geo-restriction

### CAPTCHA Providers
- 2Captcha: https://2captcha.com/support
- CapSolver: https://docs.capsolver.com

### Proxy Providers  
- Bright Data: https://brightdata.com
- Smartproxy: https://smartproxy.com
- Proxy-Cheap: https://proxy-cheap.com

## ⚡ Shortcuts

### Test 1 Link Custom
```bash
node quick-test.js "YOUR_TIKTOK_LINK_HERE"
```

### Test 5 Links Only
Edit `test-workflow.js` line 92:
```javascript
const TEST_LINKS = [...].slice(0, 5);
```
Then run:
```bash
node test-workflow.js
```

### Check Proxy Quality
```bash
node check-proxy.js
```

### Run Original Web UI
```bash
# Terminal 1
cd backend
node index.js

# Terminal 2  
cd frontend
node server.js

# Browser
http://localhost:3000
```

## ✅ Checklist Trước Khi Chạy

- [ ] Proxy configured trong `test-config.json`
- [ ] CAPTCHA API key added (nếu cần)
- [ ] Test quick-test.js trước
- [ ] Check proxy type (residential/mobile tốt nhất)
- [ ] Đủ disk space cho screenshots (~100MB)

## 🎉 Done!

Workflow sẵn sàng! Run `quick-test.js` để bắt đầu.

---

Made with ❤️ | Updated: Oct 20, 2025
