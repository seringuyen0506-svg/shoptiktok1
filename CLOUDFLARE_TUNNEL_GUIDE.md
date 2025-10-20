# 🌐 Hướng dẫn Test qua Cloudflare Tunnel

## 📋 Tổng quan

Dự án đã được cấu hình để hoạt động với Cloudflare Tunnel, cho phép test từ thiết bị khác/mạng 4G mà không cần deploy.

## ✅ Những gì đã được cấu hình

### 1. Frontend (app.js)
- ✅ Loại bỏ tất cả hard-code `http://localhost:5000`
- ✅ Sử dụng đường dẫn tương đối `/api/...`
- ✅ Thêm `credentials: 'include'` cho tất cả fetch requests
- ✅ API calls: `/api/check-ip`, `/api/check-apikey`, `/api/crawl`

### 2. Backend (index.js)
- ✅ Trust proxy: `app.set('trust proxy', 1)`
- ✅ CORS configuration:
  - Allow `*.trycloudflare.com`
  - Allow `localhost:3000`, `localhost:5000`
  - Credentials enabled
- ✅ Health check endpoints:
  - `GET /health` → returns "ok"
  - `GET /api/health` → returns JSON with timestamp

### 3. Frontend Server (server.js)
- ✅ API Proxy middleware: `/api/*` → `http://localhost:5000/api/*`
- ✅ Health proxy: `/health` → `http://localhost:5000/health`
- ✅ Trust proxy enabled

## 🚀 Cách sử dụng

### Bước 1: Khởi động server local

```powershell
# Terminal 1: Backend
cd backend
node index.js

# Terminal 2: Frontend
cd frontend
node server.js
```

### Bước 2: Mở Cloudflare Tunnel

```powershell
cloudflared tunnel --url http://localhost:3000
```

**Output sẽ như:**
```
2025-10-20T10:30:00Z INF +--------------------------------------------------------------------------------------------+
2025-10-20T10:30:00Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2025-10-20T10:30:00Z INF |  https://your-random-name.trycloudflare.com                                                |
2025-10-20T10:30:00Z INF +--------------------------------------------------------------------------------------------+
```

### Bước 3: Test từ thiết bị khác

#### 3.1 Test Health Check
Mở browser trên điện thoại/máy khác:
```
https://your-random-name.trycloudflare.com/health
```
**Phải thấy:** `ok`

#### 3.2 Test API Health
```
https://your-random-name.trycloudflare.com/api/health
```
**Phải thấy:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-20T10:30:00.000Z",
  "service": "TikTok Shop Crawler API"
}
```

#### 3.3 Test Full UI
```
https://your-random-name.trycloudflare.com
```

**Kiểm tra:**
- ✅ UI hiển thị đầy đủ
- ✅ Nhập proxy → Click "Lưu Proxy" → Thành công
- ✅ Click "🔍 Kiểm tra IP" → Thấy thông tin proxy
- ✅ Nhập API Key → Click "✓ Kiểm tra API Key" → Verify thành công
- ✅ Nhập links → Click "🚀 Bắt đầu Crawl" → Crawl thành công

### Bước 4: Kiểm tra Network Tab

1. Mở DevTools (F12) trên browser
2. Tab Network
3. Click các button

**Phải thấy:**
- ✅ Requests đến `/api/check-ip`, `/api/check-apikey`, `/api/crawl`
- ✅ **KHÔNG** có request đến `http://localhost:5000`
- ✅ Status: 200 OK
- ✅ Response data đầy đủ

## 🔍 Troubleshooting

### Lỗi: CORS error
**Nguyên nhân:** Backend chưa khởi động hoặc CORS config sai

**Giải pháp:**
1. Restart backend server
2. Check console log có message "Backend running on port 5000"

### Lỗi: 404 Not Found khi gọi /api/...
**Nguyên nhân:** Frontend proxy chưa hoạt động

**Giải pháp:**
1. Check frontend server có message "API proxy: http://localhost:3000/api -> http://localhost:5000/api"
2. Test trực tiếp: `http://localhost:3000/health` phải trả về "ok"

### Lỗi: Mixed Content (HTTPS → HTTP)
**Nguyên nhân:** Frontend đang gọi `http://localhost:...` trực tiếp

**Giải pháp:**
1. Check lại app.js không còn hard-code localhost
2. Phải dùng đường dẫn tương đối `/api/...`

### Lỗi: Connection refused
**Nguyên nhân:** Backend không chạy

**Giải pháp:**
```powershell
cd backend
node index.js
```

## 📊 Architecture

```
[Thiết bị remote/4G]
         ↓
[Cloudflare CDN/Tunnel]  (HTTPS)
         ↓
[Frontend Server :3000]
    ├─ Static files (HTML, CSS, JS)
    └─ API Proxy: /api/* → Backend :5000
         ↓
[Backend Server :5000]
    ├─ GET  /health
    ├─ GET  /api/health
    ├─ POST /api/check-ip
    ├─ POST /api/check-apikey
    └─ POST /api/crawl
         ↓
[Puppeteer] → [TikTok Shop] → [hmcaptcha.com]
```

## 🎯 Best Practices

1. **Luôn test local trước:**
   ```
   http://localhost:3000 → Phải work
   ```

2. **Kiểm tra health check:**
   ```
   http://localhost:3000/health → "ok"
   http://localhost:3000/api/health → JSON
   ```

3. **Dùng DevTools Network Tab:**
   - Filter: `/api/`
   - Check request URL không có "localhost"
   - Check response status

4. **Tunnel chỉ dùng để test:**
   - Không phải production
   - URL thay đổi mỗi lần restart tunnel
   - Free tier có rate limit

## 🔐 Security Notes

- ✅ CORS chỉ allow `.trycloudflare.com` và `localhost`
- ✅ Credentials included cho cookie-based auth (nếu cần sau)
- ✅ Trust proxy để lấy đúng IP thật từ Cloudflare headers
- ⚠️ Không expose API Key hoặc Proxy password trong frontend

## 📝 Checklist

Trước khi test qua tunnel:

- [ ] Backend running: `node backend/index.js`
- [ ] Frontend running: `node frontend/server.js`
- [ ] Health check local: `http://localhost:3000/health` → "ok"
- [ ] API health check: `http://localhost:3000/api/health` → JSON
- [ ] Tunnel started: `cloudflared tunnel --url http://localhost:3000`
- [ ] Copy tunnel URL: `https://xxx.trycloudflare.com`
- [ ] Test health từ remote: `https://xxx.trycloudflare.com/health`
- [ ] Test full UI từ remote

## 🎉 Success Indicators

Khi mọi thứ hoạt động đúng:

1. ✅ Health check trả về "ok"
2. ✅ UI load đầy đủ qua tunnel
3. ✅ Các button hoạt động bình thường
4. ✅ Network tab không có error
5. ✅ Không có request đến localhost
6. ✅ Data crawl thành công

---

**Tạo bởi:** TikTok Shop Crawler Pro Team
**Version:** 1.0.0
**Updated:** 2025-10-20
