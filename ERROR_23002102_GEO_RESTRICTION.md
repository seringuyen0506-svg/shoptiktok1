# 🔴 TikTok Error Code 23002102 - Geo-Restriction Issue

## Vấn đề

API TikTok trả về:
```json
{
  "code": 0,
  "data": {
    "global_data": {
      "product_info": {
        "error_code": 23002102,  // ⚠️ Product not available in region
        "product_info": {
          "seller_id": "",
          "product_id": "1731171796518080838"
        }
      }
    }
  }
}
```

**Error Code 23002102** = "Product is not available for sale in your region"

---

## Nguyên nhân

### 1. Proxy Datacenter (Chính)
- TikTok phát hiện **datacenter IP** và block
- Mặc dù proxy là US nhưng **fingerprint không đủ tốt**
- TikTok có hệ thống anti-fraud mạnh

### 2. Browser Fingerprint
- User-Agent không đủ
- Thiếu headers như `Sec-Ch-Ua`, `Sec-Fetch-*`
- Timezone không khớp với IP region
- Canvas fingerprint có thể bị detect

### 3. TikTok Anti-Bot
- Puppeteer bị detect qua:
  - `navigator.webdriver = true`
  - Missing `window.chrome` object
  - Permissions API khác browser thật
  - Plugin list khác nhau

---

## Giải pháp đã implement ✅

### 1. Improved US Browser Fingerprinting
```javascript
// US-specific headers
'Accept-Language': 'en-US,en;q=0.9',  // Only US English
'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
'Sec-Ch-Ua-Mobile': '?0',
'Sec-Ch-Ua-Platform': '"Windows"',
'Sec-Fetch-Dest': 'document',
'Sec-Fetch-Mode': 'navigate',
'Sec-Fetch-Site': 'none',
'Sec-Fetch-User': '?1'
```

### 2. Hide Automation Completely
```javascript
// Remove webdriver
delete Object.getPrototypeOf(navigator).webdriver;

// Real plugins
navigator.plugins = [
  { name: 'PDF Viewer' },
  { name: 'Chrome PDF Viewer' },
  { name: 'Chromium PDF Viewer' }
];

// Hardware specs
navigator.hardwareConcurrency = 8;
navigator.deviceMemory = 8;
```

### 3. US Timezone
```javascript
// UTC-5 (US Eastern Time)
Date.prototype.getTimezoneOffset = () => 300;
```

### 4. Chrome Object
```javascript
window.chrome = { 
  runtime: {}, 
  loadTimes: function() {}, 
  csi: function() {} 
};
```

---

## Giải pháp bổ sung (nếu vẫn bị block) 🚀

### Option 1: Dùng Residential Proxy ⭐⭐⭐ (Khuyến nghị)
```
Datacenter Proxy:
- IP từ data center
- TikTok detect dễ dàng
- ❌ Bị block

Residential Proxy:
- IP từ ISP thật (Comcast, Verizon...)
- Giống người dùng thật 100%
- ✅ Không bị block

Providers:
- Bright Data (residential)
- Smartproxy (residential)
- Oxylabs (residential)
- NetNut (mobile)
```

**Thay proxy endpoint:**
```
# Thay vì datacenter
p.webshare.io:80:user:pass

# Dùng residential
pr.oxylabs.io:7777:user:pass  # residential
```

### Option 2: Mobile Proxy ⭐⭐⭐
```
Mobile proxies = IP từ 4G/5G carrier
- Rất khó block (IP động)
- Giống người dùng mobile thật
- ✅ Success rate cao nhất

Providers:
- Soax (mobile)
- Proxy-Cheap (mobile)
- MobileProxy.Space
```

### Option 3: Rotate Proxy Sessions
```javascript
// Tạo session ID mới mỗi request
const sessionId = Math.random().toString(36).substring(7);
const proxy = `p.webshare.io:80:user-ZP85NKvw-region-us-sessid-${sessionId}:password`;
```

Mỗi session = IP mới → Tránh rate limit

### Option 4: Add Cookies
```javascript
// Set TikTok cookies trước khi navigate
await page.setCookie(
  {
    name: 'tt_chain_token',
    value: 'abc123...',
    domain: '.tiktok.com'
  },
  {
    name: 'ttwid',
    value: 'def456...',
    domain: '.tiktok.com'
  }
);
```

Cookies từ browser thật → TikTok trust hơn

### Option 5: Warm-up Browser
```javascript
// Visit TikTok homepage trước
await page.goto('https://www.tiktok.com', { waitUntil: 'networkidle2' });
await randomDelay(3000, 5000);

// Scroll một chút
await page.evaluate(() => window.scrollBy(0, 500));
await randomDelay(1000, 2000);

// Rồi mới goto product page
await page.goto(productUrl);
```

Giống người dùng thật browse → Ít bị suspect

---

## Test Checklist ✅

Sau khi implement improvements, test với:

### 1. Kiểm tra proxy type
```bash
# Check IP info
curl --proxy p.webshare.io:80 --proxy-user user:pass ipinfo.io
```

Output should show:
- ✅ `country: US`
- ✅ `org: Comcast / AT&T / Verizon` (residential)
- ❌ NOT `org: DigitalOcean / AWS / Vultr` (datacenter)

### 2. Test với link khác
Thử link product khác (có thể link này đặc biệt bị restrict):
```
https://www.tiktok.com/@shopname/product/123456789
```

### 3. Test không có proxy
```javascript
// Tạm thời remove proxy
const proxy = null;
```

Nếu **không có proxy mà vẫn lấy được data** → Proxy là vấn đề!

### 4. Check API response
Xem log:
```
=== FULL API Response ===
{
  "code": 0,
  "data": {
    "global_data": {
      "product_info": {
        "error_code": ???  // Nếu không có error_code = OK!
      }
    }
  }
}
```

---

## Kết luận

**Vấn đề chính:** Proxy datacenter bị TikTok detect

**Giải pháp tốt nhất:**
1. ⭐⭐⭐ **Dùng Residential/Mobile proxy**
2. ⭐⭐ **Rotate proxy sessions**
3. ⭐ **Add cookies + warm-up**

**Code đã cải thiện:**
- ✅ US browser fingerprint
- ✅ Hide automation
- ✅ Real plugins & hardware specs
- ✅ US timezone
- ✅ Chrome object
- ✅ Sec-* headers

**Test ngay với improved code!** Nếu vẫn bị block → cần đổi sang residential proxy.
