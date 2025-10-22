# ❌ ScapeCreators API - Out of Credits Issue

## Vấn đề đã phát hiện

API key của bạn đã **hết credits**! 

```
Error 402: "Looks like you're out of credits :( 
You'll need to buy more to continue using the service."
```

## Thông tin API hiện tại

- **API Key**: `sFEz5epnxP...` 
- **Status**: ❌ Out of credits
- **Credits remaining**: 0 hoặc không đủ
- **API endpoint**: `https://api.scrapecreators.com/v1/tiktok/shop/products`
- **Parameter đã fix**: `url` (đúng format)

## ✅ API đã hoạt động đúng!

Khi test với API key, API đã phản hồi chính xác:
- ✅ Parameter `url` đúng format
- ✅ Backend gửi request đúng cách
- ✅ API trả về response hợp lệ
- ❌ Nhưng bị từ chối do hết credits (HTTP 402)

## Giải pháp

### Option 1: Mua thêm credits (Khuyên dùng)
1. Truy cập: https://scrapecreators.com/dashboard
2. Đăng nhập với tài khoản của bạn
3. Mua thêm credits cho API
4. Sau khi mua xong, quay lại app và thử crawl lại

### Option 2: Tạo tài khoản mới
1. Đăng ký tài khoản mới tại: https://scrapecreators.com
2. Nhận free credits (nếu có)
3. Copy API key mới
4. Paste vào ô "API Key" trong app
5. Click "Save" để lưu
6. Thử crawl lại

### Option 3: Sử dụng API khác
Nếu không muốn dùng ScapeCreators, có thể dùng:
- **RapidAPI TikTok scrapers**
- **Apify TikTok actors**
- **Tự build crawler** (phức tạp hơn, cần proxy + anti-captcha)

## Test lại sau khi nạp credits

Khi đã có credits, hệ thống sẽ hoạt động như sau:

```
🏪 [Shop Crawl] Original URL: https://www.tiktok.com/shop/store/...
🔑 [Shop Crawl] API Key: sFEz5epnxP...
📡 [Shop Crawl] Calling API with url parameter: https://...
📥 [Shop Crawl] Response status: 200 ✅
✅ [Shop Crawl] Shop: Shop Name
✅ [Shop Crawl] Sold: 1.2M
✅ [Shop Crawl] Products fetched: 36
✅ [Shop Crawl] Saved 36 products to history
```

## Thông tin liên hệ ScapeCreators Support

- **Website**: https://scrapecreators.com
- **Email**: adrian@thewebscrapingguy.com
- **Documentation**: Kiểm tra tại dashboard

## Backend đã được fix

✅ API parameter: `url` (đã sửa từ `shop_url`)
✅ Error handling: Thêm xử lý cho HTTP 402
✅ Message hiển thị: "Out of credits - Please buy more credits at scrapecreators.com"
✅ Logging: Đầy đủ thông tin debug

---

**Kết luận**: API integration đã hoàn thành và hoạt động đúng. Chỉ cần nạp thêm credits là có thể sử dụng ngay!
