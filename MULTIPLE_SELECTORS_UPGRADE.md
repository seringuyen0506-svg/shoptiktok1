# Multiple Selectors Upgrade - Product + Shop Page Support

## Vấn đề trước đây
- Chỉ có 1 selector cho mỗi field
- Chỉ hoạt động trên **Product page**
- Không hoạt động trên **Shop page**
- Nếu selector thay đổi → fail hoàn toàn

## Giải pháp mới ⭐

### 1. Multiple Selector Arrays
Mỗi field có **NHIỀU selector** (CSS + XPath) cho cả Product page và Shop page:

```javascript
// SHOP NAME
const SHOP_NAME_CSS = [
  '...product-page-selector...',  // Thử đầu tiên
  '...shop-page-selector...',     // Fallback
];
const SHOP_NAME_XPATH = [
  '//...product-page-xpath...',
  '//...shop-page-xpath...',
];
```

### 2. Smart Fallback Logic
Function `getFirstMatch()` thử **TẤT CẢ** selectors theo thứ tự:

```javascript
async function getFirstMatch(page, cssList, xpathList) {
  // 1. Try all CSS selectors (timeout 5s mỗi cái)
  for (const css of cssList) {
    const value = await getTextByCss(page, css, 5000);
    if (value) return { value, via: 'css', selector: css };
  }
  
  // 2. Try all XPath selectors
  for (const xpath of xpathList) {
    const value = await getTextByXPath(page, xpath, 5000);
    if (value) return { value, via: 'xpath', selector: xpath };
  }
  
  // 3. Return null nếu không tìm thấy
  return { value: null, via: null, selector: null };
}
```

### 3. Detailed Logging
Log chi tiết selector nào được dùng:

```javascript
console.log('Shop Name:', shopNameResult.value, `(via ${shopNameResult.via})`);
console.log('Shop Sold:', shopSoldResult.value, `(via ${shopSoldResult.via})`);
```

## Selector Coverage

### Product Page Selectors
```javascript
// Shop card bên trái
SHOP_NAME:  '#root > ... > div.flex.flex-row.items-center > div > span'
SHOP_SOLD:  '#root > ... > span.H4-Semibold.text-color-UIText1'

// Product details
PRODUCT_NAME: '#root > ... > h1 > span'
PRODUCT_SOLD: '#root > ... > div.flex.flex-row.items-center > span'
```

### Shop Page Selectors
```javascript
// Shop header
SHOP_NAME:  '#root > ... > div > h1'
SHOP_SOLD:  '#root > ... > div:nth-child(3) > div.font-semibold'

// Product list (không có product-specific data)
PRODUCT_NAME: null (shop page không có single product)
PRODUCT_SOLD: null
```

## XPath Fallbacks
Mỗi CSS selector có XPath tương ứng:
```javascript
XPATH_SHOP_NAME: [
  '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[2]/div/a/div/div[1]/div/span',
  '//*[@id="root"]/div/div/div/div[2]/div/div[2]/div[1]/div[2]/div/h1',
]
```

## Timeout Strategy
- **5 seconds** per selector (không đợi lâu)
- Thử nhiều selectors nhanh hơn là đợi 1 selector lâu
- Total max: 5s × số selectors (flexible)

## Benefits
✅ Support cả **Product page** và **Shop page**
✅ Nếu TikTok thay đổi HTML → có fallback
✅ Log chi tiết selector nào đã dùng
✅ Fast timeout per selector (5s thay vì 20s)
✅ Graceful degradation (return null nếu không tìm thấy)

## Test Cases

### Product Page
URL: `https://www.tiktok.com/view/product/1234567890`
- ✅ Shop Name: từ shop card
- ✅ Shop Sold: từ shop stats
- ✅ Product Name: từ h1
- ✅ Product Sold: từ sold badge

### Shop Page
URL: `https://www.tiktok.com/@shopname`
- ✅ Shop Name: từ header h1
- ✅ Shop Sold: từ stats section
- ❌ Product Name: N/A (shop page)
- ❌ Product Sold: N/A (shop page)

## Usage
```javascript
// Tự động detect page type và dùng selector phù hợp
const result = await advancedDOMExtraction(page);

// Result bao gồm context
{
  shopName: 'ShopName',
  shopSold: '1200',
  productName: 'Product Title',  // hoặc '' nếu shop page
  productSold: '500'              // hoặc '' nếu shop page
}
```

## Performance
- **Before**: 20s timeout × 1 selector = 20s nếu fail
- **After**: 5s timeout × 4 selectors = 20s max, nhưng success ngay khi match đầu tiên (thường < 5s)

## Next Steps
- [ ] Add more selectors nếu TikTok thay đổi layout
- [ ] Support mobile selectors (m.tiktok.com)
- [ ] Add region-specific selectors (vt.tiktok.com vs www.tiktok.com)
