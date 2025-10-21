# TikTok Shop Crawler - Deploy Guide

This guide helps you deploy:
- Backend (Express + Puppeteer) to Render using Dockerfile
- Frontend (React UMD static) to Vercel

## Backend (Render)

- Root: `backend/` (contains Dockerfile)
- Build & Run:
  - Render will build the Docker image using `backend/Dockerfile`.
  - App listens on `PORT` env (defaults to 5000). Render sets it automatically.
- Recommended Environment Variables:
  - `NODE_ENV=production`
  - `ALLOW_ORIGINS=https://<your-frontend>.vercel.app` (comma-separated for multiple)
  - Optional: `HM_CAPTCHA_API_KEY` if you want a default; the UI can still pass it per request.
- Persistent data:
  - History is stored in `backend/data/history.json`. Attach a Render Persistent Disk and mount to `/app/backend/data` if you need persistence across restarts.
- Health checks:
  - `GET /health` -> `ok`
  - `GET /api/health` -> JSON status

## Frontend (Vercel)

- Root: `frontend/`
- Static hosting (no build step required). Ensure `index.html` and `app.js` are present.
- Backend URL:
  - The app calls relative `/api/...`. For cross-origin deployment, set a reverse proxy or add a UI field to configure base URL.
  - Optionally, add a custom domain or Vercel rewrite to forward `/api` to your Render backend.

## CORS

The backend enables CORS with credentials for:
- `*.trycloudflare.com`
- `*.vercel.app`
- `http://localhost:<port>`
- Additional origins can be added via `ALLOW_ORIGINS` env.

## Dockerfile notes

- Base image: `node:20-bookworm-slim`
- Installs system libs required by Chromium for Puppeteer.
- `npm ci --omit=dev`
- Exposes `5000` but uses `PORT` at runtime.

## Troubleshooting

- If Chromium missing dependency: update `backend/Dockerfile` with the required package and redeploy.
- If CORS blocked on Vercel domain: add it to `ALLOW_ORIGINS` on Render.
- If history not persisting on Render free tier: attach a Persistent Disk.

## Scripts

Backend: `npm start` in `backend/` runs `index.js`.

---

Happy crawling!# 🚀 TikTok Shop Crawler - CHỈ DÙNG HMCAPTCHA

## ⚡ Tính năng chính

### ✅ CAPTCHA Solver
- **CHỈ hỗ trợ:** hmcaptcha.com
- **Các loại CAPTCHA:**
  - 🧩 Slide CAPTCHA (trượt ghép mảnh)
  - 🎯 Select 2 Objects (chọn 2 đối tượng giống nhau)
  - 🔄 Rotate CAPTCHA App (xoay ảnh trên app)
  - 🔄 Rotate CAPTCHA Web (xoay ảnh trên web)
- **Auto-detection:** Tự động nhận diện loại captcha
- **Auto-solving:** Tự động giải và thực hiện action

### ✅ Proxy Support
- ✅ Format: `host:port:username:password`
- ✅ Authentication tự động
- ✅ Check IP trước khi crawl
- ✅ Phát hiện datacenter proxy

### ✅ Chống phát hiện bot
- ✅ Puppeteer-extra + Stealth plugin
- ✅ Override automation flags
- ✅ Random delays
- ✅ Human-like behavior

### ✅ Multi-tier Extraction
1. **API Interception** (fastest)
2. **DOM Extraction** (most reliable)
3. **JSON Parsing** (fallback)
4. **Cheerio Parsing** (last resort)

## 🔧 Cách sử dụng

### Bước 1: Chuẩn bị API Key từ hmcaptcha.com
1. Truy cập: https://hmcaptcha.com
2. Đăng ký tài khoản
3. Nạp tiền (tùy chọn theo nhu cầu)
4. Copy API Key từ dashboard

### Bước 2: Chạy Backend
```bash
cd "c:\Users\TIEN DUNG\Documents\TikTokShop\backend"
node index.js
```
**Kết quả:** `Backend running on port 5000`

### Bước 3: Chạy Frontend
```bash
cd "c:\Users\TIEN DUNG\Documents\TikTokShop\frontend"
node server.js
```
**Kết quả:** `Frontend server running at http://localhost:3000`

### Bước 4: Mở Web UI
Truy cập: **http://localhost:3000**

### Bước 5: Nhập thông tin

#### 🔒 Proxy (tùy chọn)
```
Format: host:port:username:password
Ví dụ: 43.159.20.117:12233:user-ZP85NKvw:SgcjjxXh
```
- Click **🔍 Check IP** để xác thực proxy
- Nếu là datacenter proxy, sẽ có cảnh báo

#### 🔑 API Key hmcaptcha.com
```
Paste API key của bạn vào đây
```
- Click **Lưu API Key**
- Click **🔑 Check API Key** để xác thực
- Nếu hợp lệ sẽ hiển thị balance và total tasks

#### 📝 Links TikTok (mỗi link 1 dòng)
```
https://www.tiktok.com/@shopname/product/123456
https://vm.tiktok.com/ZSjAbCdEf/
```

### Bước 6: Click "Crawl"
- ⏱️ Đợi 10-30 giây cho mỗi link
- 📊 Kết quả hiển thị real-time trong bảng
- 🔄 Nếu gặp CAPTCHA, tự động giải bằng hmcaptcha

## 📊 Kết quả mong đợi

| Link | Trạng thái | Tên shop | Sold shop | Tên sản phẩm | Sold sản phẩm |
|------|-----------|----------|-----------|--------------|---------------|
| https://... | success | Shop ABC | 1000+ | Product XYZ | 50 bán |
| https://... | captcha_solved | Shop DEF | 500+ | Product GHI | 120 bán |

## 🐛 Debug

### Nếu không crawl được:

1. **Kiểm tra file log:**
   - `backend/html_log.txt` - HTML của trang
   - `backend/screenshot_debug.png` - Screenshot trang

2. **Check console backend:**
   - Xem có lỗi gì không
   - Kiểm tra có captcha không

3. **Thử không dùng proxy:**
   - Để trống proxy field
   - Test xem có crawl được không

4. **Kiểm tra link TikTok:**
   - Đảm bảo link đúng format
   - Mở link trên trình duyệt xem có hoạt động không

## 📝 Lưu ý

- **Random delay:** Có delay 2-5s giữa mỗi request để tránh bị ban
- **Proxy:** Nên dùng proxy chất lượng, residential tốt hơn datacenter
- **Rate limit:** Không crawl quá nhiều link cùng lúc (khuyến nghị ≤ 10 links)
- **Captcha:** Nếu gặp captcha, cần có API key hmcaptcha.com

## 🎯 Format Proxy đúng

```
host:port:username:password
```

**Ví dụ:**
```
43.159.20.117:12233:user-ZP85NKvw-region-us-sessid-UUo9s9kd-sesstime-1:SgcjjxXh
```

## 🚨 Troubleshooting

### Lỗi: "Proxy connection failed"
- ✅ Kiểm tra proxy còn hoạt động không
- ✅ Kiểm tra format proxy đúng chưa
- ✅ Thử proxy khác

### Lỗi: "Timeout"
- ✅ Tăng timeout trong code (đã set 90s)
- ✅ Kiểm tra internet connection
- ✅ Link TikTok có hoạt động không

### Lỗi: "No data extracted"
- ✅ TikTok có thể đã đổi selector
- ✅ Xem file `html_log.txt` để check cấu trúc HTML
- ✅ Có thể cần update selector trong code

### Lỗi: "Captcha detected"
- ✅ Nhập API key hmcaptcha.com (đăng ký tại https://hmcaptcha.com)
- ✅ Click "🔑 Check API Key" để xác thực
- ✅ Đảm bảo balance > 0
- ✅ Hệ thống sẽ TỰ ĐỘNG giải captcha

## 💡 Tips để tăng success rate

1. ✅ Sử dụng residential proxy thay vì datacenter
2. ✅ Có API key hmcaptcha.com (bắt buộc nếu gặp captcha)
3. ✅ Crawl ít link một lúc (5-10 links)
4. ✅ Đổi proxy thường xuyên nếu bị block
5. ✅ Test "Check IP" và "Check API Key" trước khi crawl
6. ✅ Đọc HMCAPTCHA_GUIDE.md để hiểu rõ hơn

## 📚 Tài liệu chi tiết

- **HMCAPTCHA_GUIDE.md** - Hướng dẫn đầy đủ về hmcaptcha.com
- **TEST_WORKFLOW_GUIDE.md** - Test với 98 links
- **QUICKSTART.md** - Quick start guide
- **PROJECT_REVIEW_SUMMARY.md** - Technical review

---

**🎉 Chúc bạn crawl thành công với hmcaptcha.com!**
