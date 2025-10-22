# Shop Crawl API Debugging Guide

## Common Issues and Solutions

### 1. Error 500 from scrapecreators.com

**Possible causes:**
- Invalid API key
- Shop URL format incorrect
- Insufficient credits
- API server issue

**Solutions:**
1. Verify API key at https://scrapecreators.com/dashboard
2. Check credits balance
3. Try different URL formats:
   - `https://www.tiktok.com/@shopname`
   - `https://www.tiktok.com/shop/store/shopname/12345`

### 2. URL Format Requirements

**Accepted formats:**
```
✅ https://www.tiktok.com/@golinutrition
✅ https://www.tiktok.com/shop/store/goli-nutrition/7495794203056835079
✅ https://www.tiktok.com/shop/store/donald-tretasco-llc/7495975775290100106

❌ tiktok.com/@shop (missing https://)
❌ www.tiktok.com (missing protocol)
```

### 3. Testing with curl

```bash
curl -X GET 'https://api.scrapecreators.com/v1/tiktok/shop/products?url=https://www.tiktok.com/@golinutrition&amount=2' \
  -H 'x-api-key: YOUR_API_KEY'
```

### 4. Backend Logs to Check

When you click "Crawl Shop", check terminal for:
```
🏪 [Shop Crawl] URL: ...
📊 [Shop Crawl] Amount: ...
🔑 [Shop Crawl] API Key: sFEz5epnxP...
📡 [Shop Crawl] Calling API with params: ...
📥 [Shop Crawl] Response status: 200 (or error code)
```

If status is not 200, check the error message:
- **401**: Invalid API key
- **403**: Access denied
- **429**: Rate limit exceeded
- **500**: API server error (contact support)

### 5. Contact Support

If error persists:
- Email: adrian@thewebscrapingguy.com
- Include: API key (first 10 chars), shop URL, error message
- Note: This is a new endpoint, may have issues

### 6. Cost Information

- 1 credit per 30 products (per page)
- Example: 60 products = 2 credits
- Check balance before large requests

### 7. Timeout Settings

- Default: 120 seconds (2 minutes)
- If timing out, try:
  - Reduce amount (fewer products)
  - Try again during off-peak hours
  - Contact support if persistent
