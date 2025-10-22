# 🛍️ TikTok Shop Crawler - Product Tracking & Analytics

> **Professional tool to crawl TikTok Shop products, track sales growth over time, and get AI-powered insights**

[![Production Ready](https://img.shields.io/badge/status-production%20ready-success)](./PRODUCTION_READINESS.md)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](./docker-compose.yml)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## ✨ Features

### 🔍 Product Crawling
- **Single/Batch Crawl**: Crawl 1 hoặc nhiều TikTok Shop products
- **Automatic Data Extraction**: Tên, giá, sold count, rating, images
- **Proxy Support**: US residential proxies để bypass geo-restrictions
- **Stealth Mode**: Puppeteer stealth plugin tránh detection

### 📊 Growth Tracking
- **Historical Data**: Track sold count qua thời gian
- **Timestamp Recording**: Mỗi crawl có timestamp (DD/MM/YYYY HH:mm:ss)
- **Trend Analysis**: Xem sản phẩm nào đang trending

### 🤖 AI Analysis (DeepSeek)
- **Smart Insights**: AI phân tích growth trends
- **Top Performers**: Identify sản phẩm bán chạy nhất
- **Recommendations**: AI đề xuất chiến lược

### 🏪 Shop Bulk Crawl
- **Entire Shop**: Crawl tất cả products của 1 shop
- **ScapeCreators API**: Integration sẵn
- **Fast & Efficient**: Bulk import vào database

### 💎 Professional UI
- **Clean Design**: Modern, responsive interface
- **Progress Tracking**: Real-time progress bars (no popups!)
- **Error Handling**: User-friendly error messages
- **Dark Theme Ready**: Professional color scheme

---

## 🚀 Quick Start

### Option 1: Docker Compose (Khuyên dùng)

```bash
# Clone repo
git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1

# Configure environment
cp .env.example .env
nano .env  # Edit ALLOW_ORIGINS

# Start services
docker compose up -d

# Access app
open http://localhost
```

### Option 2: Manual Setup

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend
cd backend
PORT=5000 node index.js

# Start frontend (new terminal)
cd frontend
PORT=3000 node unified-server.js

# Access app
open http://localhost:3000
```

---

## 📖 Documentation

- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Full deployment instructions
- **[Production Readiness](./PRODUCTION_READINESS.md)** - Complete system audit
- **[Quick Start](./QUICKSTART.md)** - Get started in 5 minutes
- **[API Documentation](./API_DOCS.md)** - Backend API reference

---

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express** - API server
- **Puppeteer** - Web scraping with headless Chrome
- **Puppeteer Stealth** - Anti-detection
- **Axios** - HTTP client cho external APIs
- **Cheerio** - HTML parsing

### Frontend
- **React** (UMD) - UI framework
- **CSS Variables** - Professional theming
- **LocalStorage** - API key persistence

### Deployment
- **Docker** + **docker-compose** - Containerization
- **Nginx** - Reverse proxy
- **PM2** - Process manager (alternative)
- **Cloudflare Tunnel** - Secure tunneling (optional)

---

## 🔧 Configuration

### Environment Variables

```bash
# Backend
ALLOW_ORIGINS=https://yourdomain.com,http://localhost:3000
PORT=5000
NODE_ENV=production

# Frontend
PORT=3000
```

### API Keys (User Input Only)

**DeepSeek AI** (for growth analysis):
- Get key: https://platform.deepseek.com
- Nhập qua UI
- Saved in browser localStorage

**ScapeCreators** (for shop bulk crawl):
- Get key: https://scrapecreators.com
- Nhập qua UI  
- Saved in browser localStorage

⚠️ **Note**: ScapeCreators API hiện có bug. See [SCRAPECREATORS_API_ISSUE_FINAL.md](./SCRAPECREATORS_API_ISSUE_FINAL.md)

---

## 📸 Screenshots

### Main Dashboard
![Dashboard](./screenshots/dashboard.png)

### AI Analysis
![AI Analysis](./screenshots/ai-analysis.png)

---

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:5000/health
# Response: ok

curl http://localhost:5000/api/health
# Response: {"status":"ok","timestamp":"...","service":"TikTok Shop Crawler API"}
```

### Test Crawl
```bash
# Run test suite
cd backend
node test-endpoints.js
```

---

## 🚨 Known Issues

### 1. ScapeCreators API
- **Status**: External API có bug `initialProducts is not iterable`
- **Workaround**: Đang chờ provider fix hoặc dùng alternative API
- **Details**: [SCRAPECREATORS_API_ISSUE_FINAL.md](./SCRAPECREATORS_API_ISSUE_FINAL.md)

### 2. TikTok Geo-Restrictions
- **Issue**: Error 23002102 khi crawl không có US proxy
- **Solution**: Dùng US residential proxies
- **Format**: `host:port:username:password`

### 3. Rate Limiting
- **Issue**: TikTok có thể block nếu crawl quá nhiều
- **Solution**: Use delays giữa các requests, rotate proxies

---

## � Project Structure

```
TikTokShop/
├── backend/
│   ├── index.js              # Main API server (2707 lines)
│   ├── package.json          # Dependencies
│   ├── Dockerfile            # Production Docker image
│   └── data/
│       └── history.json      # Persisted crawl data
├── frontend/
│   ├── app.js                # React UI (2155 lines)
│   ├── index.html            # Entry point
│   ├── unified-server.js     # Express + proxy
│   └── package.json          # Dependencies
├── infra/
│   └── nginx/
│       ├── nginx.conf        # HTTP config
│       └── nginx.https.conf  # HTTPS config
├── docker-compose.yml        # Development setup
├── docker-compose.prod.yml   # Production + HTTPS
├── .env.example              # Environment template
├── DEPLOYMENT_GUIDE.md       # Full deployment guide
└── PRODUCTION_READINESS.md   # System audit report
```

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

- **Puppeteer** - Headless Chrome automation
- **DeepSeek** - AI analysis API
- **ScapeCreators** - TikTok scraping API
- **hmcaptcha.com** - CAPTCHA solving service

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/seringuyen0506-svg/shoptiktok1/issues)
- **Documentation**: See `/docs` folder
- **Email**: [Your contact]

---

## ⭐ Star History

If you find this project helpful, please give it a star! ⭐

---

**Made with ❤️ for TikTok Shop sellers**

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: October 22, 2025


4. **Kiểm tra link TikTok:**
   - Đảm bảo link đúng format
   - Mở link trên trình duyệt xem có hoạt động không

## 📝 Lưu ý

- **Random delay:** Có delay 2-5s giữa mỗi request để tránh bị ban
- **Proxy:** Nên dùng proxy chất lượng, residential tốt hơn datacenter
- **Rate limit:** Không crawl quá nhiều link cùng lúc (khuyến nghị ≤ 10 links)
- **Captcha:** Nếu gặp captcha, cần có API key hmcaptcha.com

## 🎯 Format Proxy đúng

```
host:port:username:password
```

**Ví dụ:**
```
43.159.20.117:12233:user-ZP85NKvw-region-us-sessid-UUo9s9kd-sesstime-1:SgcjjxXh
```

## 🚨 Troubleshooting

### Lỗi: "Proxy connection failed"
- ✅ Kiểm tra proxy còn hoạt động không
- ✅ Kiểm tra format proxy đúng chưa
- ✅ Thử proxy khác

### Lỗi: "Timeout"
- ✅ Tăng timeout trong code (đã set 90s)
- ✅ Kiểm tra internet connection
- ✅ Link TikTok có hoạt động không

### Lỗi: "No data extracted"
- ✅ TikTok có thể đã đổi selector
- ✅ Xem file `html_log.txt` để check cấu trúc HTML
- ✅ Có thể cần update selector trong code

### Lỗi: "Captcha detected"
- ✅ Nhập API key hmcaptcha.com (đăng ký tại https://hmcaptcha.com)
- ✅ Click "🔑 Check API Key" để xác thực
- ✅ Đảm bảo balance > 0
- ✅ Hệ thống sẽ TỰ ĐỘNG giải captcha

## 💡 Tips để tăng success rate

1. ✅ Sử dụng residential proxy thay vì datacenter
2. ✅ Có API key hmcaptcha.com (bắt buộc nếu gặp captcha)
3. ✅ Crawl ít link một lúc (5-10 links)
4. ✅ Đổi proxy thường xuyên nếu bị block
5. ✅ Test "Check IP" và "Check API Key" trước khi crawl
6. ✅ Đọc HMCAPTCHA_GUIDE.md để hiểu rõ hơn

## 📚 Tài liệu chi tiết

- **HMCAPTCHA_GUIDE.md** - Hướng dẫn đầy đủ về hmcaptcha.com
- **TEST_WORKFLOW_GUIDE.md** - Test với 98 links
- **QUICKSTART.md** - Quick start guide
- **PROJECT_REVIEW_SUMMARY.md** - Technical review

---

**🎉 Chúc bạn crawl thành công với hmcaptcha.com!**
