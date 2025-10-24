# Sequential Crawl with Browser Keep-Alive

## Tổng Quan Thay Đổi

Đã sửa đổi logic crawler để crawl nhiều link theo yêu cầu:

### ✅ Các Tính Năng Mới

1. **Crawl Tuần Tự (Sequential)**
   - Crawl từng link một, không crawl song song (concurrent)
   - Link tiếp theo chỉ bắt đầu sau khi link trước hoàn thành

2. **Quản Lý Tab Thông Minh**
   - Mở tab mới cho mỗi link
   - Đóng tab ngay sau khi crawl xong link đó
   - Browser tiếp tục chạy cho link tiếp theo

3. **Browser Không Tự Động Đóng**
   - Browser GIỮ MỞ sau khi tất cả link crawl xong
   - Người dùng PHẢI ĐÓng thủ công
   - Cho phép người dùng xem lại kết quả hoặc debug

## 🔧 Chi Tiết Thay Đổi

### File: `backend/index.js` - Endpoint `/api/crawl`

#### 1. Loại Bỏ Concurrent Workers
**Trước:**
```javascript
// Promise.all với nhiều workers song song
const workers = Array.from({ length: CONCURRENCY }).map(async (_, workerNum) => {
  while (true) {
    const current = idx++;
    if (current >= links.length) break;
    await crawlUrl(links[current]);
  }
});
await Promise.all(workers);
```

**Sau:**
```javascript
// Sequential loop - từng link một
for (let i = 0; i < links.length; i++) {
  const url = links[i];
  console.log(`\n🔄 Processing link ${i + 1}/${links.length}`);
  await crawlUrl(url);
}
```

#### 2. Tạo Session Browser Duy Nhất
**Thêm mới:**
```javascript
// Tạo 1 browser instance cho toàn bộ session
let sessionBrowser = null;
let browserWasCreated = false;

if (sharedBrowser) {
  sessionBrowser = sharedBrowser; // Dùng shared nếu có
} else {
  // Tạo mới browser với headless=false
  sessionBrowser = await puppeteer.launch({
    headless: false,
    // ... các options khác
  });
  browserWasCreated = true;
}
```

#### 3. Đóng Tab Thay Vì Đóng Browser
**Trước:**
```javascript
if (browser === sharedBrowser) {
  await page.close();
} else {
  await browser.close(); // ❌ Đóng cả browser
}
```

**Sau:**
```javascript
// ✅ Luôn luôn chỉ đóng tab
await page.close();
console.log('✓ Tab closed, browser stays open for next URL');
```

#### 4. Không Đóng Browser Sau Khi Hoàn Thành
**Thêm mới:**
```javascript
// Sau khi crawl xong TẤT CẢ các link
console.log('✅ CRAWLING COMPLETE!');
console.log('✅ Browser window is still open for your review');
console.log('💡 You can close the browser manually when done');

// KHÔNG có lệnh browser.close() ở đây!
```

#### 5. Error Handling Không Đóng Browser
**Thêm mới:**
```javascript
} catch (error) {
  // Kể cả khi lỗi, browser vẫn giữ mở
  console.log('⚠️  Browser window is still open for debugging');
  // KHÔNG đóng browser
}
```

## 📊 Workflow Mới

```
1. User gửi request crawl nhiều link
          ↓
2. Tạo/Dùng browser instance duy nhất
          ↓
3. For mỗi link (tuần tự):
   a. Mở tab mới
   b. Crawl link đó
   c. Đóng tab
   d. Tiếp tục link tiếp theo
          ↓
4. Tất cả link xong
          ↓
5. Browser VẪN MỞ
          ↓
6. User đóng thủ công khi muốn
```

## 🧪 Cách Test

### Chạy Test Script:
```bash
cd backend
node test-sequential-crawl.js
```

### Kiểm Tra Thủ Công:
1. Start backend server: `npm start`
2. Gửi POST request đến `/api/crawl` với nhiều links
3. **Verify:**
   - Console log hiển thị "Processing link 1/N", "Processing link 2/N", etc. (tuần tự)
   - Browser window mở ra
   - Mỗi link mở tab mới, sau đó đóng tab
   - Sau khi xong, browser VẪN MỞ
   - Phải đóng browser thủ công

### Example Request:
```javascript
POST http://localhost:5000/api/crawl
Content-Type: application/json

{
  "links": [
    "https://www.tiktok.com/@shop1/video/123",
    "https://www.tiktok.com/@shop2/video/456",
    "https://www.tiktok.com/@shop3/video/789"
  ],
  "note": "Test sequential crawl"
}
```

## ⚠️ Lưu Ý Quan Trọng

1. **Performance:**
   - Crawl tuần tự chậm hơn crawl song song
   - Với 50 link, thời gian sẽ tăng gấp đôi/ba
   - Trade-off: Tốc độ vs Stability & User Control

2. **Memory:**
   - Browser giữ mở sẽ chiếm memory
   - Cần người dùng đóng để giải phóng tài nguyên
   - Không nên crawl quá nhiều link (khuyến nghị < 100)

3. **User Experience:**
   - Browser hiện ra trước mắt người dùng
   - Có thể xem real-time quá trình crawl
   - Dễ debug nếu có vấn đề

## 🎯 Kết Quả Mong Đợi

✅ Links được crawl từng cái một (không song song)  
✅ Mỗi tab đóng sau khi crawl xong  
✅ Browser giữ mở cho link tiếp theo  
✅ Sau khi xong tất cả, browser VẪN MỞ  
✅ Người dùng đóng thủ công khi muốn  

## 🔍 Debug Tips

Nếu gặp vấn đề:

1. **Check Console Logs:**
   - Xem có log "Processing link X/Y" tuần tự không
   - Xem có log "Tab closed, browser stays open"
   - Xem có log "Browser window is still open"

2. **Check Browser:**
   - Browser có mở ra không?
   - Có thấy tabs mở/đóng tuần tự không?
   - Browser có tự động đóng không? (KHÔNG nên đóng)

3. **Check Response:**
   - Response có message "Browser window remains open" không?
   - Results có đầy đủ cho tất cả links không?

## 📝 Files Thay Đổi

- ✏️ `backend/index.js` - Sửa endpoint `/api/crawl`
- ➕ `backend/test-sequential-crawl.js` - Test script mới
- ➕ `SEQUENTIAL_CRAWL_CHANGES.md` - File documentation này
