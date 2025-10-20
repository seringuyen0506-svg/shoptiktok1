# 🔧 Fix: TikTok Shop JSON Data Extraction

## 🎯 Vấn đề phát hiện

TikTok Shop **KHÔNG render dữ liệu trực tiếp vào HTML DOM**. Thay vào đó:
- Trang load với message: "Product not available in this country or region"
- Dữ liệu thực sự nằm trong **JSON script** với id `__MODERN_ROUTER_DATA__`
- React hydrate từ JSON này để render UI

### HTML thực tế
```html
<div>Product not available in this country or region</div>

<!-- Dữ liệu thật ở đây -->
<script type="application/json" id="__MODERN_ROUTER_DATA__">
{
  "loaderData": {
    "view/product/(product_id)/page": {
      "page_config": {
        "global_data": {
          "product_info": {
            "product_info": {
              "title": "Faith, Fish & Hunt Hoodie...",
              "sold_count": "500+",
              ...
            }
          }
        },
        "components_map": [
          {
            "component_type": "shop_info",
            "component_data": {
              "shop_name": "BullockXp819",
              "total_sold": "400+",
              ...
            }
          }
        ]
      }
    }
  }
}
</script>
```

## ✅ Giải pháp

### Code mới (Priority-based extraction)

```javascript
const data = await page.evaluate(() => {
  // PRIORITY 1: Thử lấy data từ __MODERN_ROUTER_DATA__ JSON
  try {
    const scriptEl = document.querySelector('script#__MODERN_ROUTER_DATA__');
    if (scriptEl) {
      const jsonData = JSON.parse(scriptEl.textContent);
      const productInfo = jsonData?.loaderData?.['view/product/(product_id)/page']
        ?.page_config?.global_data?.product_info?.product_info;
      const shopInfo = jsonData?.loaderData?.['view/product/(product_id)/page']
        ?.page_config?.components_map?.find(c => c.component_type === 'shop_info')
        ?.component_data;
      
      if (productInfo || shopInfo) {
        return {
          shopName: shopInfo?.shop_name || '',
          shopSold: shopInfo?.total_sold || '',
          productName: productInfo?.title || productInfo?.product_name || '',
          productSold: productInfo?.sold_count || productInfo?.sales || '',
          fromJSON: true
        };
      }
    }
  } catch (e) {
    console.log('Failed to parse JSON data:', e.message);
  }
  
  // PRIORITY 2: Fallback về DOM selectors (cho trang Vietnam)
  // ... (code DOM extraction như cũ)
});
```

## 🔄 Flow extraction mới

```
1. Load trang TikTok Shop
   ↓
2. Tìm script#__MODERN_ROUTER_DATA__
   ↓
3. Parse JSON từ script
   ↓
4. Extract: productInfo + shopInfo từ JSON
   ↓
5. Nếu thành công → Return data
   ↓
6. Nếu thất bại → Fallback về DOM selectors
   ↓
7. Return kết quả
```

## 📊 Data structure trong JSON

### Product Info
```javascript
jsonData.loaderData['view/product/(product_id)/page']
  .page_config.global_data.product_info.product_info
  {
    "title": "Product name",
    "product_name": "Product name",
    "sold_count": "500+",
    "sales": "500+",
    "seller_id": "123456",
    "product_id": "789012"
  }
```

### Shop Info
```javascript
jsonData.loaderData['view/product/(product_id)/page']
  .page_config.components_map
  .find(c => c.component_type === 'shop_info')
  .component_data
  {
    "shop_name": "Shop Name",
    "total_sold": "400+",
    ...
  }
```

## 🎯 Kết quả mong đợi

### Trước (❌ Thất bại)
```
⚠ No data extracted, checking HTML...
```

### Sau (✅ Thành công)
```
Data source: JSON Script
Extracted data: {
  shopName: 'BullockXp819',
  shopSold: '400+',
  productName: 'Faith, Fish & Hunt Hoodie – Camo Cross...',
  productSold: '500+'
}
```

## 💡 Tại sao cần cả 2 methods?

### JSON Extraction (PRIORITY 1)
- ✅ Hoạt động với TikTok Shop (US, global)
- ✅ Dữ liệu chính xác 100%
- ✅ Không bị ảnh hưởng bởi class name changes
- ❌ Không hoạt động nếu TikTok đổi JSON structure

### DOM Selectors (PRIORITY 2 - Fallback)
- ✅ Hoạt động với TikTok Vietnam (render server-side)
- ✅ Hoạt động nếu JSON không tồn tại
- ❌ Bị ảnh hưởng bởi class name changes
- ❌ Phụ thuộc vào DOM structure

## 🧪 Test

1. **Link TikTok Shop US/Global:**
   ```
   https://vm.tiktok.com/ZTHnhmkJ47q6e-iYZNb/
   ```
   Expected: Extract từ JSON ✓

2. **Link TikTok Vietnam:**
   ```
   https://vt.tiktok.com/...
   ```
   Expected: Extract từ DOM selectors ✓

## 📝 Files thay đổi

- ✅ `backend/index.js` - Thêm JSON extraction logic
- ✅ `FIX_JSON_EXTRACTION.md` - Tài liệu này

## 🚀 Deployment

```bash
# Stop old backend
taskkill /F /IM node.exe

# Start new backend
cd backend
node index.js

# Start frontend
cd frontend
node server.js
```

## 📊 Log output

```
Crawling: https://vm.tiktok.com/ZTHnhmkJ47q6e-iYZNb/
Proxy authenticated: user-ZP85NKvw...
Navigating to: https://vm.tiktok.com/...
✓ Found selectors on page
Data source: JSON Script           ← NEW!
Extracted data: { ... }             ← NEW!
✓ Screenshot saved
Fetched HTML, length: 49487
✓ HTML saved to html_log.txt
✓ Successfully extracted data: { shopName, shopSold, productName, productSold }
```

---

**Status: ✅ FIXED - TikTok Shop data extraction working!**
