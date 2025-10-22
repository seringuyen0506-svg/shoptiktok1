# 🚀 TEST WORKFLOW LOCAL

## ✅ Workflow Đã Cập Nhật

Code đã được cập nhật với workflow đúng:

```
1. VERIFY PROXY (check IP qua ipify.org)
   ↓
2. LAUNCH BROWSER với proxy đã verify
   ↓
3. NAVIGATE đến TikTok Shop URL
   ↓
4. DETECT CAPTCHA → DỪNG LẠI
   ↓
5. SOLVE CAPTCHA (nếu có + có API key)
   ↓
6. VERIFY đã vượt qua CAPTCHA
   ↓
7. CRAWL dữ liệu sản phẩm
```

---

## 🔧 Cách Test Local

### 1. Start Backend Server

```bash
cd backend
node index.js
```

Server sẽ chạy trên: `http://localhost:5000`

### 2. Start Frontend (tab mới)

```bash
cd frontend
node server.js
```

Frontend sẽ chạy trên: `http://localhost:3000`

---

## 📝 Test Với UI

### Bước 1: Mở Browser
```
http://localhost:3000
```

### Bước 2: Nhập Proxy Mới
Trong form UI, nhập proxy (đã test working):
```
135.148.11.203:31280:PUS89186:PrX7CMv2
```

**Hoặc dùng 10 proxy khác đã test:**
```
142.147.128.93:6593:rmlkbbjk:e3s8ms72yxir  (nhanh nhất - 1098ms)
45.38.107.97:6014:rmlkbbjk:e3s8ms72yxir
216.10.27.159:6837:rmlkbbjk:e3s8ms72yxir
142.111.67.146:5611:rmlkbbjk:e3s8ms72yxir
38.170.176.177:5572:rmlkbbjk:e3s8ms72yxir
64.137.96.74:6641:rmlkbbjk:e3s8ms72yxir
31.59.20.176:6754:rmlkbbjk:e3s8ms72yxir
198.23.239.134:6540:rmlkbbjk:e3s8ms72yxir
107.172.163.27:6543:rmlkbbjk:e3s8ms72yxir
142.111.48.253:7030:rmlkbbjk:e3s8ms72yxir
```

### Bước 3: Nhập hmcaptcha API Key
```
57c29b7fde6f9b04ba13a65f1e92ba5d
```

### Bước 4: Test Với URL
Paste một trong các URL test:

**URL đã crawl được title:**
```
https://vm.tiktok.com/ZTHnhmN6d3fAG-aJavt/
```

**Hoặc các URL khác:**
```
https://www.tiktok.com/shop/pdp/1731808374866153635
https://www.tiktok.com/shop/pdp/cute-christmas-movie-watching-shirt-sweatshirt-fur-frauen/1731714475920101400
https://www.tiktok.com/shop/pdp/retro-christmas-nutcracker-sweatshirt-unisex-fit-soft-fabric/1731643452134690842
```

### Bước 5: Click "Crawl"

---

## 📊 Kết Quả Mong Đợi

### ✅ Thành Công:
```
🔌 Verifying proxy connection...
✅ Proxy verified - IP: 135.148.11.203

🌐 Navigating to: https://www.tiktok.com/...
✓ Navigation successful

🔍 STEP 3: Phát hiện CAPTCHA...
✅ Không phát hiện CAPTCHA - tiếp tục crawl

✅ STEP 5: TIẾP TỤC CRAWL DỮ LIỆU
✓ Found selectors on page

📦 Extracted data:
  Title: King of Kings Hoodie – Christian...
  Price: $24.99
  Sold: 1.2K sold
```

### 🔒 Nếu Gặp CAPTCHA:
```
🔍 STEP 3: Phát hiện CAPTCHA...
⏸️  DỪNG LẠI - CAPTCHA phát hiện: ALL_CAPTCHA_SLIDE

🤖 STEP 4: Bắt đầu giải CAPTCHA với hmcaptcha...
📸 CAPTCHA screenshot saved: debug/captcha_*.png
🤖 Gửi đến hmcaptcha.com API...
✅ CAPTCHA ĐÃ GIẢI XONG! Chờ page reload...

✅ Đã vượt qua CAPTCHA thành công!
✅ STEP 5: TIẾP TỤC CRAWL DỮ LIỆU
```

### ❌ Nếu Proxy Fail:
```
🔌 Verifying proxy connection...
❌ Proxy verification failed: Request failed with status code 407

Error: Proxy không hoạt động: Request failed with status code 407
Suggestion: Kiểm tra proxy credentials hoặc thử proxy khác
```

---

## 🐛 Debug

### Xem Backend Logs
```bash
# Terminal backend sẽ show real-time logs:
🔌 Verifying proxy connection...
✅ Proxy verified - IP: 135.148.11.203
🚀 Launching browser...
🔍 STEP 3: Phát hiện CAPTCHA...
...
```

### Check Debug Screenshots
Nếu có CAPTCHA, screenshots được lưu tại:
```
backend/debug/captcha_*.png
```

### Test Riêng Proxy
```bash
cd backend
node test-all-proxies.js
```

---

## 📌 Notes

1. **Concurrency**: Để tránh CAPTCHA, set concurrency = 1 hoặc 2 (không nên > 2)

2. **Proxy**: Đã verify 11 proxy working (10 + 1 mới)

3. **CAPTCHA**: Nếu gặp nhiều CAPTCHA, giảm tốc độ crawl hoặc đổi proxy

4. **Title Only**: Hiện tại crawl được title, price & sold cần update selectors (TikTok Shop có React rendering)

---

## 🎯 Next Steps (Optional)

Nếu muốn improve thêm:

1. **Update Price/Sold Selectors**: Test nhiều URLs để tìm đúng selectors
2. **Add Retry Logic**: Retry nếu CAPTCHA solve fail
3. **Proxy Pool**: Rotate giữa 11 proxies để giảm block rate
4. **Rate Limiting**: Add delay giữa các requests

---

## ✅ Commit Info

**Branch**: `wip/proxy-debug-2025-10-22`
**Commit**: `d8badbf`
**Files Changed**: 7 files (1590 insertions)

**New Files:**
- `backend/crawl-workflow-correct.js` - Workflow test script
- `backend/test-all-proxies.js` - Proxy testing tool
- `backend/test-multiple-urls.js` - Multi-URL testing
- `backend/debug-crawl-detailed.js` - Detailed debugging
- `backend/test-tiktok-shop.js` - TikTok Shop specific test

**Updated Files:**
- `backend/index.js` - Main crawl endpoint with new workflow
- `backend/test-config.json` - Proxy config

---

**Happy Testing! 🚀**
