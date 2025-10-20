# 🔧 Fix: Shop Sold Selector

## ✅ Đã sửa (19/10/2025)

### Vấn đề
Shop Sold đang lấy nhầm dữ liệu, không lấy từ phần "Món bán ra"

### HTML Structure đúng
```html
<div>
  <span class="H4-Semibold text-color-UIText1">400+</span>
  <span class="Headline-Regular text-color-UIText2"> <!-- -->Món bán ra</span>
</div>
```

### Code cũ (SAI)
```javascript
shopSold: getText([
  'span.H4-Semibold.text-color-UIText1',  // ← Lấy span đầu tiên tìm được
  'span[class*="H4-Semibold"][class*="UIText1"]',
  'div[class*="shop-sold"] span'
])
```

**Vấn đề:** Lấy bất kỳ span.H4-Semibold nào đầu tiên, không check xem có liên quan đến "Món bán ra" không.

### Code mới (ĐÚNG)
```javascript
// Lấy shop sold - tìm text "Món bán ra" rồi lấy số ở phần trước
const getShopSold = () => {
  // Tìm tất cả span có text "Món bán ra"
  const allSpans = Array.from(document.querySelectorAll('span'));
  const targetSpan = allSpans.find(span => 
    span.textContent.includes('Món bán ra') || 
    span.textContent.includes('món bán ra')
  );
  
  if (targetSpan) {
    // Lấy parent div, tìm span.H4-Semibold ở trước nó
    const parentDiv = targetSpan.closest('div');
    if (parentDiv) {
      const numberSpan = parentDiv.querySelector('span.H4-Semibold.text-color-UIText1');
      if (numberSpan) return numberSpan.textContent.trim();
    }
  }
  
  // Fallback: tìm trực tiếp span.H4-Semibold kế bên span có text "Món bán ra"
  const headlineSpans = Array.from(document.querySelectorAll('span.Headline-Regular'));
  for (const span of headlineSpans) {
    if (span.textContent.includes('Món bán ra')) {
      const prevSibling = span.previousElementSibling;
      if (prevSibling && prevSibling.classList.contains('H4-Semibold')) {
        return prevSibling.textContent.trim();
      }
    }
  }
  
  return '';
};
```

### Logic mới
1. ✅ Tìm span có text "Món bán ra"
2. ✅ Lấy parent div của span đó
3. ✅ Trong parent div, tìm `span.H4-Semibold.text-color-UIText1`
4. ✅ Return text của span đó (VD: "400+")
5. ✅ Nếu không tìm được, dùng fallback: tìm previousSibling

### Cũng sửa trong Cheerio fallback
```javascript
// Tìm shopSold - lấy số từ phần "Món bán ra"
let shopSold = '';
$('span').each((i, el) => {
  const text = $(el).text();
  if (text.includes('Món bán ra') || text.includes('món bán ra')) {
    const parent = $(el).parent();
    const numberSpan = parent.find('span.H4-Semibold.text-color-UIText1');
    if (numberSpan.length > 0) {
      shopSold = numberSpan.text().trim();
      return false; // Break loop
    }
  }
});
```

## 🎯 Kết quả mong đợi

### Trước
```json
{
  "shopSold": "1000+" // ← Số sai, lấy từ chỗ khác
}
```

### Sau
```json
{
  "shopSold": "400+" // ← Đúng, lấy từ "Món bán ra"
}
```

## 📝 Test

1. Backend đã restart ✓
2. Frontend đã restart ✓
3. Mở http://localhost:3000
4. Test crawl lại
5. Check cột "Sold shop" phải hiển thị "400+" (hoặc số từ "Món bán ra")

## 💡 Notes

- Code hiện giờ tìm chính xác dựa trên text "Món bán ra"
- Có fallback nếu structure HTML thay đổi
- Không còn lấy nhầm số từ chỗ khác
