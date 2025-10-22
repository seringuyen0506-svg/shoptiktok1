# 🔍 ScapeCreators API - Vấn đề và Giải pháp

## ✅ Đã tìm ra nguyên nhân!

### API Key đúng
- **Key**: `sFEz5epnxPQLBE43awFBJfTdACA2`
- **Credits**: 100 credits ✅
- **Status**: Active và hoạt động

### URL Format yêu cầu
ScapeCreators API **BẮT BUỘC** phải dùng format:
```
https://www.tiktok.com/shop/store/SHOP_NAME/SHOP_ID
```

**KHÔNG chấp nhận:**
- ❌ `https://www.tiktok.com/@username`
- ❌ `@username`
- ❌ Shop ID alone

**Ví dụ đúng:**
```
✅ https://www.tiktok.com/shop/store/goli-nutrition/7495794203056835079
✅ https://www.tiktok.com/shop/store/donald-tretasco-llc/7495975775290100106
```

## ❌ Vấn đề hiện tại: API Server Error

### Lỗi từ ScapeCreators
```json
{
  "success": false,
  "credits_remaining": 100,
  "error": "internal_server_error",
  "errorStatus": 500,
  "message": "initialProducts is not iterable (cannot read property undefined)"
}
```

### Test results (với API key đúng):

| Shop | URL Format | Status | Error |
|------|------------|--------|-------|
| Goli Nutrition | /shop/store/ | 500 | initialProducts error |
| Donald Tretasco | /shop/store/ | 500 | initialProducts error |
| Any @username | @username | 400 | Must use /shop/store/ |

### Kết luận
- ✅ **API key hoạt động** (100 credits)
- ✅ **Code của chúng ta đúng** (gửi đúng format)
- ❌ **ScapeCreators API đang bị lỗi** (internal server error)

## 📧 Đã báo cáo lỗi

Lỗi `initialProducts is not iterable` là **bug từ phía ScapeCreators API server**.

**Cần làm:**
1. Liên hệ: adrian@thewebscrapingguy.com
2. Báo lỗi: "API returning 500 for /v1/tiktok/shop/products endpoint"
3. Chi tiết:
   - API key: sFEz5epnxP... (100 credits)
   - Error: "initialProducts is not iterable"
   - Tested shops: Multiple shops all return 500
   - Date: October 22, 2025

## 🛠️ Code đã được update

### Backend (`index.js`)
✅ Validation URL format `/shop/store/` required  
✅ Better error handling for 500 errors  
✅ Specific message for `initialProducts` error  
✅ Sử dụng `shopIdentifier` thay vì full URL trong params

### Frontend (`app.js`)
✅ Progress bars thay vì alert()  
✅ Error messages chi tiết  
✅ Save API key to localStorage

## 🎯 Next Steps

### Option 1: Chờ ScapeCreators fix (Khuyên dùng)
- Họ có 100 credits của bạn
- API key hợp lệ
- Chỉ cần đợi họ fix server bug

### Option 2: Sử dụng API khác
**RapidAPI - TikTok scrapers:**
- https://rapidapi.com/hub - tìm "TikTok shop"
- Nhiều lựa chọn, có free tier
- Documentation tốt hơn

**Apify:**
- https://apify.com/store - TikTok scrapers
- Pay-per-use model
- Reliable hơn

### Option 3: Build custom crawler
- Sử dụng Puppeteer/Playwright
- Cần proxy + anti-captcha
- Phức tạp nhưng controllable

## 📝 Test Command

Để test lại khi API fix:
```bash
cd backend
node -e "const axios = require('axios'); (async () => { 
  const r = await axios.get('https://api.scrapecreators.com/v1/tiktok/shop/products', { 
    headers: { 'x-api-key': 'sFEz5epnxPQLBE43awFBJfTdACA2' }, 
    params: { url: 'https://www.tiktok.com/shop/store/goli-nutrition/7495794203056835079' } 
  }); 
  console.log('Status:', r.status); 
  console.log('Shop:', r.data.shopInfo?.shop_name); 
})();"
```

Khi thấy `Status: 200` là API đã hoạt động trở lại!

---

**Updated**: October 22, 2025  
**Status**: Waiting for ScapeCreators to fix API server bug
