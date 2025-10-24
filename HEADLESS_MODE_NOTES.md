# ⚠️ HEADLESS MODE - Production Note

## 🔍 Vấn đề

Sau khi deploy lên VPS, khi click nút **"Open Browser"** trong UI, sẽ gặp lỗi:

```
❌ Lỗi: Missing X server to start the headful browser. 
Either set headless to true or use xvfb-run to run your Puppeteer script.
```

## 💡 Nguyên nhân

- **VPS không có Desktop Environment** (không có X server)
- Puppeteer không thể mở browser có **giao diện** (headful mode)
- Chỉ có thể chạy **headless mode** (browser ẩn, không hiển thị)

## ✅ Giải pháp đã áp dụng

### 1. Auto-detect Environment
Code đã được fix để tự động detect môi trường:

```javascript
// backend/index.js
launchOptions.headless = process.env.NODE_ENV === 'production' ? 'new' : false;
```

- **Local (Windows/Mac)**: `headless: false` → Browser hiển thị
- **Production (VPS)**: `headless: 'new'` → Browser ẩn (headless)

### 2. Puppeteer Dependencies
Đã cài đủ dependencies cho Ubuntu 24.04:

```bash
apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2t64 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 \
  fonts-liberation libappindicator3-1 libnss3 lsb-release xdg-utils wget
```

## 📋 Hành vi mới

### Local Development
- ✅ Browser hiển thị (headful mode)
- ✅ Có thể xem quá trình crawl
- ✅ Có thể cài extension CAPTCHA
- ✅ Có thể login manual

### Production (VPS)
- ✅ Browser ẩn (headless mode)
- ✅ Crawl tự động hoàn toàn
- ❌ **KHÔNG** hiển thị browser
- ❌ **KHÔNG** cài được extension có UI
- ⚠️ CAPTCHA phải giải bằng API (hmcaptcha)

## 🎯 Impact on Features

### ✅ Vẫn hoạt động:
1. **Crawl Product/Shop** - Hoạt động bình thường
2. **Sequential Crawl** - Tab management works in headless
3. **Results Table** - Checkboxes, notes, bulk actions
4. **Growth Tracking** - History & percentage
5. **Data Persistence** - localStorage

### ⚠️ Thay đổi:
1. **Open Shared Browser** button:
   - Local: Mở browser hiển thị
   - Production: Browser ẩn (không thấy gì)
   - **Khuyến nghị**: Ẩn button này trên production

2. **CAPTCHA Solving**:
   - Local: Manual solving hoặc extension
   - Production: **CHỈ qua API** (hmcaptcha)

3. **TikTok Login**:
   - Local: Login manual trong browser
   - Production: **Cookies phải được set trước** hoặc headless login

## 🛠️ Recommendations

### Option 1: Ẩn "Open Browser" button trên Production
```javascript
// frontend/app.js
{process.env.NODE_ENV !== 'production' && (
  <button onClick={handleOpenBrowser}>Open Browser</button>
)}
```

### Option 2: Thay đổi text button
```javascript
<button onClick={handleOpenBrowser}>
  {process.env.NODE_ENV === 'production' 
    ? 'Start Headless Browser' 
    : 'Open Browser'}
</button>
```

### Option 3: Hiển thị warning
```javascript
{process.env.NODE_ENV === 'production' && (
  <div className="alert alert-warning">
    ⚠️ Production mode: Browser chạy ẩn (headless), 
    bạn sẽ không thấy giao diện browser.
  </div>
)}
```

## 🔄 Testing Headless Mode Locally

Để test headless mode trên local:

```bash
# Set NODE_ENV to production
$env:NODE_ENV="production"
npm start

# Test
# Browser sẽ chạy ẩn như trên VPS
```

## 📊 Current Status

- ✅ Code fixed (commit 2440444)
- ✅ Deployed to VPS
- ✅ Backend running on PORT 8080
- ✅ Headless mode active on production
- ⚠️ UI chưa update để reflect headless behavior

## 🎯 Next Steps

1. Update UI để hiển thị warning về headless mode
2. Hoặc ẩn "Open Browser" button trên production
3. Test crawl functionality với headless mode
4. Verify CAPTCHA API integration

---

**Updated**: 2025-10-24  
**Status**: ✅ Fixed on backend, UI update pending  
**Environment**: Production (ttshoptool.fun)
