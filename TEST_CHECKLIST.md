# ✅ CHECKLIST KIỂM TRA NHANH

## 🔧 Trước khi test:
- [ ] Backend đang chạy (`node index.js` trong backend/)
- [ ] Frontend đang chạy (mở `frontend/index.html`)
- [ ] Có proxy sẵn sàng
- [ ] Có API key hmcaptcha (optional nhưng recommended)

---

## 🧪 TEST CASES CƠ BẢN

### 1️⃣ Test Tab Navigation
- [ ] Click tab "Crawler" → Hiện form nhập link
- [ ] Click tab "Kết quả" → Hiện dashboard & time-series table
- [ ] Click tab "Lịch sử" → Hiện history table
- [ ] ✅ Không có lỗi console khi switch tabs

### 2️⃣ Test Proxy Configuration
- [ ] Nhập proxy: `IP:PORT:USER:PASS`
- [ ] Click "💾 Lưu Proxy"
- [ ] Click "🔍 Kiểm tra IP"
- [ ] ✅ Thấy IP info hiển thị (country, city...)

### 3️⃣ Test Crawl Đơn Lẻ (1 link)
- [ ] Nhập 1 link TikTok product
- [ ] Click "Crawl hàng loạt"
- [ ] ✅ Thấy progress bar
- [ ] ✅ Kết quả hiển thị (shopName, shopSold, productSold)
- [ ] ✅ Không có lỗi "504 Gateway Timeout"

### 4️⃣ Test Bulk Crawl (10 links)
- [ ] Nhập 10 links (mỗi link 1 dòng)
- [ ] Set Concurrency = 2
- [ ] Click "Crawl hàng loạt"
- [ ] ✅ Console log hiển thị progress: "Progress: 5/10 (50.0%)"
- [ ] ✅ Thấy ETA estimate
- [ ] ✅ 10 kết quả hiển thị sau khi hoàn thành

### 5️⃣ Test Bulk Crawl (50 links) - QUAN TRỌNG
- [ ] Nhập 50 links
- [ ] **BẬT checkbox "Chế độ chống 524"**
- [ ] Set Concurrency = 2
- [ ] Click "Crawl hàng loạt"
- [ ] ✅ Không bị timeout sau 2 phút
- [ ] ✅ Job polling hoạt động
- [ ] ✅ Tất cả 50 links được xử lý

### 6️⃣ Test Growth Tracking
- [ ] Crawl 1 URL lần đầu → Lưu shopSold và productSold
- [ ] Chờ shop sold thay đổi (hoặc edit data test)
- [ ] Crawl lại cùng URL
- [ ] ✅ Cột "Product Growth %" hiển thị
- [ ] ✅ Cột "Shop Growth %" hiển thị
- [ ] ✅ Badge màu xanh (positive) hoặc đỏ (negative)

### 7️⃣ Test Dashboard (Tab Kết quả)
- [ ] Click tab "Kết quả"
- [ ] ✅ Thấy 4 metric cards (Shops, Products, Best Growth, Positive Growth)
- [ ] ✅ Time-series table hiển thị với cột ngày
- [ ] ✅ Horizontal scroll hoạt động
- [ ] ✅ Filter (All/Positive/Negative) hoạt động
- [ ] ✅ Sort dropdown hoạt động

### 8️⃣ Test History Table (Tab Lịch sử)
- [ ] Click tab "Lịch sử"
- [ ] ✅ Group by Shop toggle hoạt động
- [ ] ✅ Search box tìm kiếm đúng
- [ ] ✅ Pagination (20/50/100 items) hoạt động
- [ ] ✅ Collapse/Expand groups hoạt động

### 9️⃣ Test Shop-Only Crawl
- [ ] Trong tab Lịch sử, group by shop
- [ ] Click "🔄 Crawl shop sold" trên 1 group
- [ ] ✅ Shop sold được update
- [ ] ✅ Shop growth hiển thị

### 🔟 Test Export
- [ ] Click "📥 Export JSON"
- [ ] ✅ File tải về đúng format
- [ ] ✅ Data đầy đủ trong file

---

## 🐛 TEST ERROR HANDLING

### Test Invalid Proxy
- [ ] Nhập proxy sai format
- [ ] Click crawl
- [ ] ✅ Error message rõ ràng: "Proxy không hoạt động"

### Test No Proxy
- [ ] Xóa proxy, để trống
- [ ] Click crawl
- [ ] ✅ Vẫn chạy được (nhưng có thể bị block)

### Test Network Error
- [ ] Tắt backend server
- [ ] Click crawl
- [ ] ✅ Error: "Server error" hoặc "fetch failed"

### Test CAPTCHA (nếu gặp)
- [ ] Crawl URL trigger CAPTCHA
- [ ] Có API key hmcaptcha
- [ ] ✅ Auto-solve CAPTCHA
- [ ] ✅ Tiếp tục crawl thành công

---

## 🎯 EXPECTED RESULTS

### Performance Benchmarks:
- ⏱️ **1 link:** ~10-15 giây
- ⏱️ **10 links (concurrency 2):** ~1-2 phút
- ⏱️ **50 links (async mode):** ~8-12 phút
- ⏱️ **100 links (async mode):** ~16-25 phút

### Success Criteria:
- ✅ Không có error trong console
- ✅ Không có "504 Gateway Timeout"
- ✅ Progress tracking hiển thị đúng
- ✅ Growth tracking tính toán chính xác
- ✅ Tab navigation mượt mà
- ✅ UI responsive, không lag

---

## 🔍 MONITORING TIPS

### Console Logs cần chú ý:
```
✅ Good:
⚙️ Concurrency set to 2
📊 Processing 50 links with 2 concurrent browsers
✅ Progress: 25/50 (50.0%) | Avg: 11.2s/link | ETA: ~280s
🎉 COMPLETED: 48/50 successful | Total time: 567.3s

❌ Bad:
Error: Server error: 504 Gateway Timeout
Error: Proxy connection failed
❌ [Shop Only] Error: Failed to crawl
```

### Browser DevTools:
- **Network tab:** Kiểm tra API calls (không nên thấy nhiều failed requests)
- **Console tab:** Không có error màu đỏ
- **Memory tab:** Memory usage ổn định, không tăng liên tục (memory leak)

---

## 🚨 VẤN ĐỀ ĐÃ SỬA (không cần test lại)

- ✅ AbortSignal.timeout compatibility
- ✅ Hardcoded PORT issue
- ✅ Memory leak với progressInterval
- ✅ Tab navigation implementation

---

## 📞 BÁO LỖI

Nếu phát hiện lỗi mới, ghi rõ:
1. **Bước reproduce:** Làm gì để lỗi xảy ra
2. **Error message:** Copy từ console
3. **Screenshot:** Chụp màn hình lỗi
4. **Context:** Browser gì, bao nhiêu links, proxy có hoạt động không

---

**Last Updated:** 2025-10-23  
**Version:** 1.0 (Post-Audit)

✅ **READY TO TEST!**
