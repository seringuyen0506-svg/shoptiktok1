# ⚠️ Vấn đề: TikTok Geo-Restriction

## 🔍 Root Cause

Link bạn test: `https://vm.tiktok.com/ZTHnhmkJ47q6e-iYZNb/`

TikTok trả về error:
```json
{
  "error_code": 23002102,
  "error_message": "get product detail not for sale in the region",
  "sale_region": "US"
}
```

**Nghĩa là:** Sản phẩm này chỉ bán ở **US**, nhưng request đang bị detect là từ **region khác** (có thể do proxy không đúng hoặc IP bị detect).

## 📊 JSON Data nhận được

```json
{
  "product_info": {
    "seller_id": "",
    "product_id": "1731171796518080838"
    // ← KHÔNG CÓ title, sold_count, v.v.
  }
}
```

**Kết quả:** Không có dữ liệu shop name, product name, sold count vì TikTok chặn region.

## ✅ Đã Fix (Improved)

### 1. Extract product name từ `<title>` tag
```javascript
// Nếu JSON không có product name, lấy từ title tag
let productName = productInfo?.title || '';
if (!productName) {
  const titleTag = document.querySelector('title');
  if (titleTag) {
    productName = titleTag.textContent.replace(/ - TikTok Shop/g, '').trim();
  }
}
```

**Kết quả:** Ít nhất lấy được product name từ title: "Faith, Fish & Hunt Hoodie – Camo Cross Design..."

### 2. Detect geo-restriction warning
```javascript
if (html.includes('not available in this country or region')) {
  console.log('⚠ Product is geo-restricted');
  console.log('💡 Try: Use a different link or region-specific proxy');
}
```

### 3. Check multiple JSON paths
```javascript
// Thử nhiều nơi để tìm data
const productInfo = loaderData?.page_config?.global_data?.product_info?.product_info;
const productData = loaderData?.page_config?.components_map
  ?.find(c => c.component_type === 'product_info')?.component_data;
const shopData = loaderData?.page_config?.components_map
  ?.find(c => c.component_type === 'shop_info')?.component_data;
```

## 🎯 Giải pháp

### Option 1: Dùng link TikTok Vietnam ✅ KHUYẾN NGHỊ
```
https://vt.tiktok.com/ZS...  (link Vietnam)
```
- ✅ Dữ liệu đầy đủ
- ✅ Không bị geo-block
- ✅ Render server-side, dễ crawl hơn

### Option 2: Dùng US residential proxy
```
Proxy phải là:
- Residential IP (không phải datacenter)
- US region
- Chất lượng cao, không bị TikTok blacklist
```

### Option 3: Dùng link product từ seller Vietnam
Tìm sản phẩm tương tự từ seller Vietnam thay vì US.

## 📝 Cách test đúng

### ❌ SAI (Link US với proxy không tốt)
```
Link: https://vm.tiktok.com/... (US link)
Proxy: IP đã bị TikTok detect
→ Kết quả: Geo-restricted, không có data
```

### ✅ ĐÚNG (Link Vietnam)
```
Link: https://vt.tiktok.com/... (VN link)
Proxy: Không cần hoặc VN proxy
→ Kết quả: Full data với shop name, sold count
```

### ✅ ĐÚNG (Link US với proxy tốt)
```
Link: https://vm.tiktok.com/... (US link)
Proxy: US residential IP chất lượng cao
→ Kết quả: Full data
```

## 🧪 Test ngay

1. **Tìm link TikTok Vietnam:**
   - Mở TikTok app ở Vietnam
   - Hoặc search "tiktok shop vietnam" + product
   - Copy link (bắt đầu bằng `https://vt.tiktok.com/`)

2. **Test crawl:**
   - Paste vào form
   - Không cần proxy (hoặc dùng VN proxy)
   - Click "Crawl"
   - Sẽ lấy được full data ✓

## 💡 Tại sao ban đầu crawl được?

**Giả thuyết:**
1. Ban đầu test với link Vietnam → Data đầy đủ
2. Bây giờ test với link US + proxy không phù hợp → Geo-blocked
3. Hoặc: TikTok mới cập nhật geo-restriction

## 🔧 Code đã cải thiện

### Trước
```javascript
// Chỉ lấy từ 1 JSON path
const productInfo = jsonData?.loaderData?.['view/product/(product_id)/page']
  ?.page_config?.global_data?.product_info?.product_info;
```

### Sau
```javascript
// Lấy từ nhiều JSON paths + fallback title tag
const productInfo = loaderData?.page_config?.global_data?.product_info?.product_info;
const productData = components_map?.find(c => c.component_type === 'product_info')?.component_data;
const shopData = components_map?.find(c => c.component_type === 'shop_info')?.component_data;

// Fallback: lấy product name từ title tag
if (!productName) {
  productName = document.querySelector('title').textContent.replace(/ - TikTok Shop/g, '').trim();
}
```

## 📊 Expected Output

### Link geo-blocked
```
⚠ Product is geo-restricted (not available in this region)
💡 Try: Use a different link or region-specific proxy
Data source: JSON Script
Extracted data: {
  shopName: '',
  shopSold: '',
  productName: 'Faith, Fish & Hunt Hoodie...',  ← Từ title tag
  productSold: ''
}
```

### Link Vietnam (hoặc proxy tốt)
```
Data source: JSON Script  (hoặc DOM Selectors)
Extracted data: {
  shopName: 'Shop ABC',
  shopSold: '400+',
  productName: 'Áo hoodie nam...',
  productSold: '500 bán'
}
✓ Successfully extracted data
```

---

**TL;DR:** Link bị geo-block. Dùng link TikTok Vietnam hoặc proxy US tốt hơn! 🎯
