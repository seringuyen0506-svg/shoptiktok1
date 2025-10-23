# ============================================
# 🚀 TIKTOK SHOP CRAWLER - DEPLOYMENT MASTER GUIDE
# ============================================
# Phiên bản: 2.0 (2025-10-23)
# Status: ✅ PRODUCTION READY
# ============================================

## 📊 TỔNG QUAN HỆ THỐNG

### Kiến trúc:
```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │ ───▶ │   Frontend   │ ───▶ │   Backend   │
│   (User)    │      │  (Nginx/CDN) │      │  (Node.js)  │
└─────────────┘      └──────────────┘      └─────────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │  Puppeteer  │
                                            │   + Proxy   │
                                            └─────────────┘
```

### Tech Stack:
- **Frontend:** HTML5 + React (CDN) + Nginx
- **Backend:** Node.js 24 + Express + Puppeteer
- **Database:** JSON file-based (history.json)
- **Deployment:** Docker + Docker Compose
- **Proxy:** Required for TikTok crawling
- **CAPTCHA:** hmcaptcha.com integration

---

## 🎯 LỰA CHỌN DEPLOYMENT

### **OPTION 1: Docker Compose (Khuyến nghị ⭐)**
**Phù hợp:** VPS, Cloud Server, Local Development

**Yêu cầu:**
- Docker & Docker Compose
- 2GB RAM minimum
- Ubuntu/Debian/Windows Server

**Deploy:**
```bash
# Linux/MacOS
chmod +x deploy.sh
./deploy.sh

# Windows
.\deploy.ps1
```

**Ưu điểm:**
- ✅ Dễ deploy và maintain
- ✅ Tự động build và restart
- ✅ Isolated environment
- ✅ Dễ scale và backup

---

### **OPTION 2: Cloudflare Tunnel**
**Phù hợp:** Expose local server ra internet

**Yêu cầu:**
- Cloudflare account
- Domain (free từ Cloudflare)
- Backend đang chạy local

**Setup:**
```bash
# 1. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 2. Login
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create tiktok-shop

# 4. Configure
cloudflared tunnel route dns tiktok-shop ttshoptool.fun

# 5. Run
cloudflared tunnel run tiktok-shop
```

**Chi tiết:** Xem `CLOUDFLARE_TUNNEL_GUIDE.md`

---

### **OPTION 3: Manual VPS Setup**
**Phù hợp:** Custom server configuration

**Bước 1: Install Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install Chrome/Chromium for Puppeteer
sudo apt install -y chromium-browser

# Install Nginx
sudo apt install -y nginx
```

**Bước 2: Clone & Setup Backend**
```bash
cd /opt
git clone <your-repo-url> tiktok-shop-crawler
cd tiktok-shop-crawler/backend

npm install
cp ../.env.example ../.env
# Edit .env với config của bạn

# Start backend
PORT=5000 node index.js
```

**Bước 3: Setup Frontend**
```bash
# Copy frontend to Nginx
sudo cp -r /opt/tiktok-shop-crawler/frontend/* /var/www/html/

# Configure Nginx
sudo cp infra/nginx/nginx.conf /etc/nginx/sites-available/tiktok-shop
sudo ln -s /etc/nginx/sites-available/tiktok-shop /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Bước 4: Setup PM2 (Process Manager)**
```bash
npm install -g pm2

cd /opt/tiktok-shop-crawler/backend
pm2 start index.js --name tiktok-backend
pm2 save
pm2 startup
```

---

### **OPTION 4: Platform-as-a-Service**

#### **Vercel (Frontend Only)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod

# Update backend URL in frontend/app.js
# const API_URL = 'https://your-backend-url.com'
```

#### **Render.com (Backend)**
1. Connect GitHub repo
2. Create Web Service
3. Build Command: `cd backend && npm install`
4. Start Command: `node backend/index.js`
5. Environment: Add `PORT`, `ALLOW_ORIGINS`

#### **Railway.app (Full Stack)**
1. Connect GitHub repo
2. Add `nixpacks.toml` or `Dockerfile`
3. Set environment variables
4. Deploy

---

## ⚙️ CONFIGURATION

### Environment Variables (.env):
```bash
# Backend
PORT=5000
NODE_ENV=production
ALLOW_ORIGINS=https://yourdomain.com

# Optional
HMCAPTCHA_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
DEFAULT_PROXY=IP:PORT:USER:PASS
DEFAULT_CONCURRENCY=2
```

### Nginx Configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 600s;  # 10 minutes for bulk crawl
    }
}
```

---

## 🔐 SECURITY CHECKLIST

- [ ] Set strong proxy credentials
- [ ] Use HTTPS (SSL certificate)
- [ ] Set CORS ALLOW_ORIGINS correctly
- [ ] Don't expose .env file
- [ ] Use firewall (ufw/iptables)
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Rate limiting (if public facing)

---

## 📈 PERFORMANCE TUNING

### Backend Optimization:
```javascript
// Increase timeout for bulk crawl
server.timeout = 600000; // 10 minutes ✅ Already done

// Limit concurrency
DEFAULT_CONCURRENCY=2  // Safe value ✅ Already done

// Memory management
NODE_OPTIONS=--max-old-space-size=2048
```

### Nginx Optimization:
```nginx
# Cache static files
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Gzip compression
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript;
```

---

## 🧪 POST-DEPLOYMENT TESTING

### 1. Health Check:
```bash
curl http://localhost:8080/health
# Expected: {"status":"ok","timestamp":"...","service":"TikTok Shop Crawler API"}
```

### 2. API Test:
```bash
curl -X POST http://localhost:8080/api/check-ip \
  -H "Content-Type: application/json" \
  -d '{"proxy":"IP:PORT:USER:PASS"}'
```

### 3. Frontend Access:
```
Open: http://yourdomain.com
- Tab "Crawler" should load
- Proxy input should work
- Health check button functional
```

### 4. Full Crawl Test:
```
1. Add proxy in UI
2. Add 1-2 TikTok links
3. Click "Crawl hàng loạt"
4. Verify results display
5. Check "Lịch sử" tab for saved data
```

---

## 🐛 TROUBLESHOOTING

### Port Already in Use:
```bash
# Linux
sudo lsof -i :8080
sudo kill -9 <PID>

# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Puppeteer Chrome Not Found:
```bash
# Install Chromium
sudo apt install -y chromium-browser

# Or use bundled Chromium
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npm install puppeteer
```

### CORS Errors:
```bash
# Add your domain to ALLOW_ORIGINS in .env
ALLOW_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 504 Gateway Timeout:
```bash
# Already fixed with 10-minute timeout ✅
# If still happens:
# 1. Enable async mode in UI
# 2. Reduce concurrency to 1
# 3. Check proxy stability
```

---

## 📦 BACKUP & RESTORE

### Backup Data:
```bash
# Backup history.json
tar -czf backup-$(date +%Y%m%d).tar.gz backend/data/history.json

# Full backup
tar -czf fullbackup-$(date +%Y%m%d).tar.gz \
    backend/data/ \
    .env \
    docker-compose.yml
```

### Restore:
```bash
tar -xzf backup-20251023.tar.gz
docker-compose restart backend
```

---

## 🔄 UPDATE & MAINTENANCE

### Update Code:
```bash
cd /opt/tiktok-shop-crawler
git pull origin main
cd backend && npm install
docker-compose up -d --build
```

### View Logs:
```bash
# Docker
docker-compose logs -f backend

# PM2
pm2 logs tiktok-backend

# Nginx
sudo tail -f /var/log/nginx/access.log
```

### Restart Services:
```bash
# Docker
docker-compose restart

# PM2
pm2 restart tiktok-backend

# Systemd
sudo systemctl restart tiktok-backend
```

---

## 📞 SUPPORT & RESOURCES

### Documentation:
- `QUICKSTART.md` - Quick start guide
- `BULK_CRAWL_OPTIMIZATION.md` - Bulk crawl optimization
- `CLOUDFLARE_TUNNEL_GUIDE.md` - Cloudflare Tunnel setup
- `PROJECT_AUDIT_REPORT.md` - Full audit report
- `TEST_CHECKLIST.md` - Testing checklist

### Logs Location:
- Backend: `docker-compose logs backend`
- Debug HTML: `backend/debug/html_log.txt`
- History Data: `backend/data/history.json`

### Common Issues:
- Check `PROJECT_AUDIT_REPORT.md` for known issues
- See `TROUBLESHOOTING.md` for solutions

---

## ✅ FINAL CHECKLIST

Pre-Deployment:
- [ ] Code reviewed and tested
- [ ] .env configured
- [ ] Docker/Nginx installed
- [ ] Domain DNS pointed to server
- [ ] SSL certificate ready (optional)

Post-Deployment:
- [ ] Health check passes
- [ ] Frontend accessible
- [ ] Backend API responds
- [ ] Proxy test successful
- [ ] Crawl test with 2-3 links works
- [ ] Logs monitoring setup
- [ ] Backup strategy in place

---

## 🚀 QUICK START COMMANDS

### Development:
```bash
cd backend && PORT=5000 node index.js
# Open frontend/index.html in browser
```

### Production (Docker):
```bash
docker-compose up -d --build
```

### Production (Manual):
```bash
pm2 start backend/index.js --name tiktok-backend
sudo systemctl start nginx
```

---

**🎉 Happy Deploying!**

**Thời gian deploy ước tính:**
- Docker: ~5-10 phút
- Manual VPS: ~20-30 phút
- Cloudflare Tunnel: ~10-15 phút

**Khuyến nghị:** Sử dụng Docker Compose cho deployment nhanh và dễ maintain!
