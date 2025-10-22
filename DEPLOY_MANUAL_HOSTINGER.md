# 🚀 Deploy Manual lên Hostinger VPS

## Bước 1: SSH vào VPS

```bash
ssh root@148.230.100.21
```

Nhập password từ Hostinger hPanel.

## Bước 2: Chạy các lệnh sau trên VPS

### 2.1. Update system
```bash
apt update && apt upgrade -y
```

### 2.2. Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### 2.3. Install PM2
```bash
npm install -g pm2
```

### 2.4. Install Nginx
```bash
apt install -y nginx
```

### 2.5. Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### 2.6. Clone repository
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1
git checkout wip/proxy-debug-2025-10-22
```

### 2.7. Install dependencies
```bash
# Backend
cd /var/www/shoptiktok1/backend
npm install --production

# Frontend
cd /var/www/shoptiktok1/frontend
npm install --production
```

### 2.8. Create .env file
```bash
cd /var/www/shoptiktok1
cat > .env << 'EOF'
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun
NODE_ENV=production
EOF
```

### 2.9. Start services with PM2
```bash
# Backend
cd /var/www/shoptiktok1/backend
pm2 start index.js --name tiktokshop-backend

# Frontend
cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name tiktokshop-frontend

# Save PM2 config
pm2 save

# Auto-start on reboot
pm2 startup
# Copy và chạy lệnh mà PM2 suggest
```

### 2.10. Configure Nginx
```bash
cat > /etc/nginx/sites-available/ttshoptool.fun << 'EOF'
server {
    listen 80;
    server_name ttshoptool.fun www.ttshoptool.fun;

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

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/ttshoptool.fun /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
```

### 2.11. Configure firewall
```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
```

### 2.12. Check status
```bash
pm2 status
```

## Bước 3: Configure DNS trong Hostinger hPanel

1. Login: https://hpanel.hostinger.com
2. Go to: **Domains** → **ttshoptool.fun** → **DNS Zone**
3. Add A Record:
   - **Type**: A
   - **Name**: @
   - **Points to**: 148.230.100.21
   - **TTL**: 14400
4. Add A Record:
   - **Type**: A
   - **Name**: www
   - **Points to**: 148.230.100.21
   - **TTL**: 14400
5. Click **Save**

## Bước 4: Đợi DNS Propagate

Đợi 5-30 phút, check tại:
- https://dnschecker.org

Hoặc test:
```bash
nslookup ttshoptool.fun
```

## Bước 5: Setup SSL Certificate

Sau khi DNS đã propagate:

```bash
certbot --nginx \
  -d ttshoptool.fun \
  -d www.ttshoptool.fun \
  --email seringuyen0506@gmail.com \
  --agree-tos \
  --non-interactive
```

## ✅ Hoàn tất!

Website của bạn giờ chạy tại:
- **http://ttshoptool.fun** (tự động redirect to HTTPS sau khi setup SSL)
- **https://ttshoptool.fun** (sau khi setup SSL)

## 📊 Management Commands

### Check status
```bash
ssh root@148.230.100.21 'pm2 status'
```

### View logs
```bash
ssh root@148.230.100.21 'pm2 logs'
```

### Restart services
```bash
ssh root@148.230.100.21 'pm2 restart all'
```

### Update code
```bash
ssh root@148.230.100.21
cd /var/www/shoptiktok1
git pull origin wip/proxy-debug-2025-10-22
pm2 restart all
```

## 🔧 Troubleshooting

### Port 3000 đã được sử dụng
```bash
lsof -i :3000
kill -9 <PID>
pm2 restart all
```

### Check Nginx error
```bash
tail -f /var/log/nginx/error.log
```

### Check PM2 logs
```bash
pm2 logs tiktokshop-backend
pm2 logs tiktokshop-frontend
```
