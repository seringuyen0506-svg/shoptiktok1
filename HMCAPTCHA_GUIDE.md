# 🔑 Hướng Dẫn Sử Dụng hmcaptcha.com

## 📋 Tổng Quan

Dự án này **CHỈ hỗ trợ hmcaptcha.com** để giải CAPTCHA TikTok. Các service khác (2Captcha, CapSolver, AntiCaptcha) đã bị loại bỏ.

## 🎯 Các Loại CAPTCHA TikTok Được Hỗ Trợ

### 1. **SLIDE CAPTCHA** (Trượt để xác minh)
- **Type:** `ALL_CAPTCHA_SLIDE`
- **Mô tả:** Kéo thanh trượt để ghép mảnh puzzle
- **Response:** `{ offset: 78, x: 210, y: 652 }`
- **Ứng dụng:** Tự động kéo slider đến vị trí đúng

### 2. **SELECT 2 OBJECTS** (Chọn 2 đối tượng giống nhau)
- **Type:** `TIKTOK_OBJ`
- **Mô tả:** Chọn 2 hình ảnh có cùng hình dạng
- **Response:** `{ raw: "0.61413,0.62064|0.48913,0.819767" }` (tọa độ tương đối)
- **Ứng dụng:** Tự động click vào 2 điểm

### 3. **ROTATE CAPTCHA APP** (Xoay ảnh trên app)
- **Type:** `TIKTOK_ROTATE_APP`
- **Mô tả:** Xoay ảnh để đúng góc
- **Response:** `{ angle: 78, point_slide: {x: 210, y: 652} }`
- **Công thức:** `offset = angle * (width_slide / 180)`

### 4. **ROTATE CAPTCHA WEB** (Xoay ảnh trên web)
- **Type:** `TIKTOK_ROTATE_WEB`
- **Mô tả:** Xoay ảnh bằng 2 layer (inner + outer)
- **Response:** `{ angle: 78 }`
- **Cần:** 2 URL images (ảnh bên trong + ảnh bên ngoài)

## 🔧 Cách Sử Dụng

### 1️⃣ Đăng Ký hmcaptcha.com
1. Truy cập: https://hmcaptcha.com
2. Đăng ký tài khoản
3. Nạp tiền vào tài khoản
4. Copy API Key từ dashboard

### 2️⃣ Cấu Hình API Key
**Trong Web UI:**
```
1. Mở http://localhost:3000
2. Paste API Key vào ô "API Key hmcaptcha.com"
3. Click "Lưu API Key"
4. Click "🔑 Check API Key" để xác thực
```

**Trong Test Scripts:**
```javascript
// backend/test-config.json
{
  "apiKey": "YOUR_HMCAPTCHA_API_KEY_HERE"
}
```

### 3️⃣ Check API Key Balance
```bash
# Qua Web UI
Click nút "🔑 Check API Key"

# Response hiển thị:
✅ API Key hợp lệ! (hmcaptcha.com)
💰 Balance: $5.00
📊 Total Tasks: 1234
```

## 📡 API Endpoints

### ✅ Check Balance
**GET** `https://hmcaptcha.com/api/getBalance?apikey={YOUR_API_KEY}`

**Response:**
```json
{
  "Code": 0,
  "Data": {
    "Balance": 5.00,
    "TotalTask": 1234
  }
}
```

### 🧩 Submit CAPTCHA (với wait=1)
**POST** `https://hmcaptcha.com/Recognition?wait=1`

**Body:**
```json
{
  "Apikey": "YOUR_API_KEY",
  "Type": "ALL_CAPTCHA_SLIDE",
  "Image": "BASE64_ENCODED_IMAGE"
}
```

**Response (Success):**
```json
{
  "Code": 0,
  "Status": "SUCCESS",
  "Data": {
    "offset": 78,
    "x": 210,
    "y": 652
  }
}
```

**Response (Error):**
```json
{
  "Code": 1,
  "Message": "Error description"
}
```

### 🔄 Get Result (nếu không dùng wait=1)
**GET** `https://hmcaptcha.com/getResult?apikey={API_KEY}&taskid={TASK_ID}`

**Response States:**
- `PENDING`: Đang chờ xử lý
- `PROCESSING`: Đang giải
- `SUCCESS`: Đã giải xong
- `ERROR`: Lỗi

## 💰 Giá Cả (Tham khảo)

| Loại CAPTCHA | Giá/1000 lần |
|--------------|--------------|
| Slide        | ~$0.50       |
| Select 2 Obj | ~$0.80       |
| Rotate       | ~$0.60       |

## 🚀 Workflow Tự Động

### Code Flow trong Project:
```
1. Phát hiện CAPTCHA
   ↓
2. Xác định loại (Slide/Obj/Rotate)
   ↓
3. Capture ảnh CAPTCHA
   ↓
4. Convert sang Base64
   ↓
5. Gửi đến hmcaptcha API
   ↓
6. Nhận kết quả (offset/coordinates/angle)
   ↓
7. Thực hiện action (kéo/click/xoay)
   ↓
8. Retry extraction
```

### Ví Dụ Code (Slide CAPTCHA):
```javascript
// 1. Capture image
const captchaImg = await page.$eval('img[src*="captcha"]', el => el.src);

// 2. Convert to base64
const imgRes = await axios.get(captchaImg, { responseType: 'arraybuffer' });
const imageBase64 = Buffer.from(imgRes.data).toString('base64');

// 3. Submit to hmcaptcha
const response = await axios.post('https://hmcaptcha.com/Recognition?wait=1', {
  Apikey: apiKey,
  Type: 'ALL_CAPTCHA_SLIDE',
  Image: imageBase64
});

// 4. Get result
const { offset, x, y } = response.data.Data;

// 5. Perform action
await page.mouse.move(x, y);
await page.mouse.down();
await page.mouse.move(x + offset, y, { steps: 10 });
await page.mouse.up();
```

## ⚠️ Lưu Ý Quan Trọng

### 1. **Timeout**
- Timeout mặc định: 60 giây
- Nếu CAPTCHA phức tạp, có thể mất 30-45 giây

### 2. **Error Handling**
- `Code: 0` = Success
- `Code: 1` = Error (check Message field)
- Luôn kiểm tra `Code` trước khi parse `Data`

### 3. **Slide CAPTCHA trên Phone**
TikTok app có tỉ lệ khác nên cần điều chỉnh:
```javascript
// Fix tỉ lệ sai lệch
offset = offset * (45 / 57);
```

### 4. **Select 2 Objects**
Tọa độ trả về là **tương đối** (0-1):
```javascript
const { raw } = response.data.Data; // "0.61413,0.62064|0.48913,0.819767"
const imageBox = await imageElement.boundingBox();

for (const point of raw.split('|')) {
  const [xRatio, yRatio] = point.split(',').map(parseFloat);
  const clickX = imageBox.x + (xRatio * imageBox.width);
  const clickY = imageBox.y + (yRatio * imageBox.height);
  await page.mouse.click(clickX, clickY);
}
```

### 5. **Rotate Captcha**
Tính offset theo công thức:
```javascript
offset = angle * (width_slide / 180);
// hoặc
offset = angle * width * 0.00446837493;
```

## 🔍 Debugging

### Check API Key
```bash
curl "https://hmcaptcha.com/api/getBalance?apikey=YOUR_KEY"
```

### Test CAPTCHA Solving
```bash
cd backend
node quick-test.js
# Sẽ auto detect captcha và giải
```

### Log trong Console
```
🔑 Checking hmcaptcha API Key...
hmcaptcha response: { Code: 0, Data: { Balance: 5.00, TotalTask: 1234 } }
✅ hmcaptcha API Key hợp lệ! Balance: 5 Total Tasks: 1234

⚠ Captcha detected: https://...
Sending ALL_CAPTCHA_SLIDE captcha to hmcaptcha...
✓ Captcha solved: { offset: 78, x: 210, y: 652 }
Sliding captcha: offset=78px at (210, 652)
```

## 📞 Support

- **hmcaptcha.com:** https://hmcaptcha.com
- **Documentation:** https://docs.hmcaptcha.com
- **Discord/Telegram:** Check hmcaptcha.com website

## ✅ Checklist

- [ ] Đã đăng ký tài khoản hmcaptcha.com
- [ ] Đã nạp tiền vào tài khoản
- [ ] Đã copy API Key
- [ ] Đã paste vào Web UI hoặc test-config.json
- [ ] Đã test "Check API Key" và thấy balance
- [ ] Đã chạy thử 1 link để test CAPTCHA solving

---

**🎉 Chúc bạn crawl thành công!**
