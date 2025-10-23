# Tối ưu hóa Crawl hàng loạt (50-100 links)

## Vấn đề
Lỗi **504 Gateway Timeout** khi crawl nhiều link cùng lúc do:
- Timeout mặc định quá ngắn (2 phút)
- Server không kịp xử lý nhiều request
- Browser instances mở đồng thời quá nhiều

## Giải pháp đã triển khai

### 1. ✅ Tăng Timeout Backend (10 phút)
**File:** `backend/index.js`

```javascript
// Tăng timeout lên 10 phút cho xử lý bulk crawl
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 610000; // 10 minutes + 10 seconds  
server.headersTimeout = 620000; // 10 minutes + 20 seconds
```

### 2. ✅ Tăng Timeout Frontend (10 phút)
**File:** `frontend/app.js`

```javascript
const res = await fetch('/api/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ links: linkArray, proxy, apiKey, note, concurrency }),
  credentials: 'include',
  signal: AbortSignal.timeout(600000) // 10 minutes timeout
});
```

### 3. ✅ Giới hạn Concurrency (2-3 browsers)
**File:** `backend/index.js`

- Giới hạn tối đa **3 browser instances** chạy đồng thời
- Mặc định: **2 browsers** (tối ưu cho ổn định)
- Tránh overload server và giảm nguy cơ CAPTCHA

```javascript
const CONCURRENCY = Math.min(Math.max(Number.isFinite(requestedConc) ? requestedConc : 2, 1), 3);
console.log(`📊 Processing ${links.length} links with ${CONCURRENCY} concurrent browsers`);
```

### 4. ✅ Queue System với Progress Tracking
**File:** `backend/index.js`

Thêm hệ thống queue thông minh:
- Xử lý tuần tự theo nhóm (pool workers)
- Tracking tiến trình real-time
- Ước tính thời gian còn lại (ETA)
- Log chi tiết mỗi worker

```javascript
Worker 1: Processing link 15/50 - https://vt.tiktok.com/ZS...
✅ Progress: 15/50 (30.0%) | Avg: 12.3s/link | ETA: ~430s
```

### 5. ✅ UI Information Banner
**File:** `frontend/app.js`

Thêm banner thông tin trên UI:
```
💡 Tối ưu cho crawl 50-100 link: Timeout 10 phút, xử lý 2-3 link đồng thời để tránh quá tải server
```

## Hiệu suất dự kiến

### Trước khi tối ưu:
- ❌ Timeout sau 2 phút với 10+ links
- ❌ Lỗi 504 Gateway khi crawl 50 links
- ❌ Không biết tiến trình xử lý

### Sau khi tối ưu:
- ✅ Xử lý được **50-100 links** không lỗi timeout
- ✅ Thời gian xử lý: ~**10-15 giây/link** (2-3 link song song)
- ✅ **50 links ≈ 8-12 phút** (dưới mức timeout 10 phút)
- ✅ **100 links ≈ 16-25 phút** (cần bật async mode)
- ✅ Tracking real-time progress
- ✅ Server ổn định, ít CAPTCHA hơn

## Khuyến nghị sử dụng

### Crawl < 50 links:
- Dùng chế độ bình thường
- Concurrency: 2 (mặc định)
- Ước tính: ~8-12 phút

### Crawl 50-100 links:
- **BẬT chế độ Async** (checkbox "Chế độ chống 524")
- Concurrency: 2-3
- Server sẽ chạy nền và trả kết quả qua polling
- Ước tính: 15-25 phút

### Crawl > 100 links:
- **BẮT BUỘC dùng Async mode**
- Concurrency: 2 (để giảm tải)
- Chia nhỏ thành nhiều batch nếu có thể
- Ước tính: 30-60 phút

## Monitoring

Backend sẽ log chi tiết:
```
⚙️ Concurrency set to 2 (requested=default)
📊 Processing 50 links with 2 concurrent browsers
🔄 Worker 1: Processing link 1/50 - https://vt.tiktok.com/...
✅ Progress: 1/50 (2.0%) | Avg: 11.2s/link | ETA: ~548s
...
🎉 COMPLETED: 48/50 successful | Total time: 567.3s
```

## Troubleshooting

### Vẫn bị timeout sau 10 phút:
1. Giảm concurrency xuống 1
2. Bật Async mode
3. Kiểm tra proxy có ổn định không
4. Chia nhỏ batch thành 30-40 links/lần

### Nhiều CAPTCHA:
1. Giảm concurrency xuống 1
2. Thêm delay giữa các request
3. Đảm bảo có API key hmcaptcha

### Server quá tải:
1. Kiểm tra RAM/CPU server
2. Restart backend service
3. Giảm số links hoặc concurrency

## Cấu hình khuyến nghị

**Server tối thiểu:**
- RAM: 2GB+
- CPU: 2 cores+
- Bandwidth: Ổn định

**Settings tối ưu:**
- Concurrency: 2
- Timeout: 10 phút (đã set)
- Async mode: BẬT khi > 50 links
- Proxy: Sử dụng để tránh rate limit

---
**Ngày cập nhật:** 2025-10-23  
**Phiên bản:** 1.0
