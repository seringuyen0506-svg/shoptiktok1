# 🚀 TikTok Shop Crawler - Production Deployment Guide

## ✅ Pre-Deployment Checklist

### Backend
- ✅ All API endpoints tested và hoạt động
- ✅ No hardcoded secrets (API keys qua user input)
- ✅ CORS configured via ALLOW_ORIGINS env var
- ✅ Health checks: `/health` và `/api/health`
- ✅ Error handling comprehensive
- ✅ Data persistence: `backend/data/history.json`

### Frontend
- ✅ No hardcoded backend URLs (sử dụng relative paths)
- ✅ Unified server với proxy to backend
- ✅ Progress bars thay vì alerts
- ✅ LocalStorage cho API keys
- ✅ Professional UI

### Docker
- ✅ Dockerfile optimized với Puppeteer base image
- ✅ docker-compose.yml cho development
- ✅ docker-compose.prod.yml cho HTTPS
- ✅ Nginx reverse proxy configured
- ✅ Volume persistence cho data

---

## 🌐 Deployment Options

### Option 1: Docker Compose (Khuyên dùng)

#### Step 1: Clone repo
```bash
git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1
```

#### Step 2: Configure environment
```bash
cp .env.example .env
nano .env
```

Sửa `.env`:
```bash
ALLOW_ORIGINS=https://yourdomain.com,http://yourdomain.com
```

#### Step 3: Build và run
```bash
# Development (HTTP only)
docker compose up -d

# Production (với HTTPS)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Step 4: Verify
```bash
# Check containers
docker ps

# Check logs
docker logs tts-backend
docker logs tts-frontend

# Test health
curl http://localhost/health
curl http://localhost/api/health
```

#### Services:
- **Frontend**: http://localhost (nginx)
- **Backend**: http://localhost:8080 (hoặc thông qua nginx proxy)
- **Data**: Persisted in `backend-data` volume

---

### Option 2: VPS Manual Setup

#### Requirements:
- Ubuntu 20.04+ hoặc Debian 11+
- Node.js 18+
- Nginx (optional, cho reverse proxy)
- PM2 (process manager)

#### Step 1: Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Verify
```

#### Step 2: Install PM2
```bash
sudo npm install -g pm2
```

#### Step 3: Clone và setup
```bash
cd /var/www
git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..
```

#### Step 4: Configure environment
```bash
cp .env.example .env
nano .env
```

#### Step 5: Start với PM2
```bash
# Backend
pm2 start backend/index.js --name tts-backend --env production

# Frontend (unified server)
pm2 start frontend/unified-server.js --name tts-frontend --env production

# Save PM2 config
pm2 save
pm2 startup  # Follow instructions
```

#### Step 6: Setup Nginx reverse proxy
```bash
sudo nano /etc/nginx/sites-available/tiktokshop
```

Paste config:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/tiktokshop /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 7: Setup SSL với Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

### Option 3: Cloudflare Tunnel (Easiest)

#### Step 1: Install cloudflared
```bash
# Windows
choco install cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

#### Step 2: Login
```bash
cloudflared tunnel login
```

#### Step 3: Create tunnel
```bash
cloudflared tunnel create tiktokshop
```

#### Step 4: Configure tunnel
Tạo file `config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /path/to/<TUNNEL_ID>.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

#### Step 5: Route DNS
```bash
cloudflared tunnel route dns tiktokshop yourdomain.com
```

#### Step 6: Run tunnel
```bash
cloudflared tunnel run tiktokshop
```

Hoặc setup như service:
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
```

---

## 🔧 Configuration

### Environment Variables

**Backend** (`backend/index.js`):
- `PORT`: Default 5000 (local) hoặc 8080 (Docker)
- `NODE_ENV`: `production`
- `ALLOW_ORIGINS`: CORS whitelist

**Frontend** (`frontend/unified-server.js`):
- `PORT`: Default 3000

### Data Persistence

**History file**: `backend/data/history.json`
- Format: `{ items: [ ...products ] }`
- Automatically created if not exists
- Backed up in Docker volume

### API Keys (User Input)

**DeepSeek API**: Cho AI analysis
- User nhập qua UI
- Saved in localStorage
- Not persisted server-side

**ScapeCreators API**: Cho shop crawl
- User nhập qua UI
- Saved in localStorage
- Not persisted server-side

---

## 🧪 Testing Production

### Health Checks
```bash
# Frontend + Backend
curl https://yourdomain.com/health

# API health
curl https://yourdomain.com/api/health

# History
curl https://yourdomain.com/api/history
```

### Test Crawl
1. Mở https://yourdomain.com
2. Paste TikTok product URL
3. Click "Crawl"
4. Verify product appears in table

### Test AI Analysis
1. Crawl cùng 1 product nhiều lần (khác ngày)
2. Nhập DeepSeek API key
3. Chọn products
4. Click "Analyze Growth"
5. Verify AI insights hiển thị

---

## 📊 Monitoring

### PM2 Dashboard
```bash
pm2 monit
pm2 logs
pm2 list
```

### Docker Logs
```bash
docker logs -f tts-backend
docker logs -f tts-frontend
```

### Resource Usage
```bash
# PM2
pm2 status

# Docker
docker stats
```

---

## 🔄 Updates

### Update code
```bash
cd /var/www/shoptiktok1
git pull

# PM2
pm2 restart all

# Docker
docker compose down
docker compose up -d --build
```

---

## 🛡️ Security Best Practices

1. **HTTPS Only**: Luôn dùng SSL/TLS
2. **CORS**: Chỉ allow trusted origins
3. **Rate Limiting**: Consider adding rate limits
4. **API Keys**: Never commit to git
5. **Firewall**: Chỉ expose port 80/443
6. **Updates**: Thường xuyên update dependencies

---

## ⚠️ Known Issues

### ScapeCreators API
- Hiện đang có bug `initialProducts is not iterable`
- Đang chờ họ fix
- Alternative: RapidAPI hoặc custom crawler

### Proxy Issues
- TikTok có thể block IP
- Cần residential proxies cho stable crawling
- Configure proxy qua UI

---

## 📞 Support

**Issues**: https://github.com/seringuyen0506-svg/shoptiktok1/issues  
**Email**: [Your contact]

---

**Last Updated**: October 22, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
