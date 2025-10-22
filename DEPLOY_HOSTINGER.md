# Deploy TikTok Shop Crawler to Hostinger VPS

## Hostinger VPS Information
- **Domain**: ttshoptool.fun
- **Email**: seringuyen0506@gmail.com
- **VPS IP**: (Xem trong hPanel của Hostinger)
- **SSH Access**: Hostinger cung cấp trong VPS Management

## Prerequisites

### 1. Hostinger VPS Requirements
- VPS Plan active (Business/Premium)
- SSH access enabled trong hPanel
- Domain ttshoptool.fun đã trỏ về VPS IP

### 2. Trong hPanel của Hostinger:
1. Go to **VPS** → Your VPS
2. Enable **SSH Access**
3. Get **SSH credentials** (IP, Username, Password)
4. Go to **DNS Zone** → ttshoptool.fun:
   - A Record: `@` → VPS IP
   - A Record: `www` → VPS IP

## Option 1: Deploy qua PowerShell (Khuyên dùng)

### Chạy script tự động:
```powershell
.\deploy-hostinger.ps1
```

Script sẽ tự động:
- ✅ Upload code lên Hostinger VPS
- ✅ Cài Node.js, PM2, Nginx
- ✅ Configure reverse proxy
- ✅ Start ứng dụng
- ✅ Setup SSL certificate

## Option 2: Deploy thủ công

### Step 1: SSH vào Hostinger VPS

Trong hPanel:
1. VPS → SSH Access → Copy thông tin
2. Hoặc dùng terminal:

```bash
ssh root@YOUR_VPS_IP
# Nhập password từ hPanel
```

### Step 2: Cài đặt môi trường

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 process manager
npm install -g pm2

# Install Nginx (nếu chưa có)
apt install -y nginx

# Install Git
apt install -y git

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx
```

### Step 3: Clone repository

```bash
# Tạo thư mục web
mkdir -p /var/www
cd /var/www

# Clone repo
git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1

# Checkout working branch
git checkout wip/proxy-debug-2025-10-22
```

### Step 4: Install dependencies

```bash
# Backend
cd /var/www/shoptiktok1/backend
npm install --production

# Frontend
cd /var/www/shoptiktok1/frontend
npm install --production
```

### Step 5: Configure environment

```bash
cd /var/www/shoptiktok1

# Tạo .env file
cat > .env << 'EOF'
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun
NODE_ENV=production
EOF
```

### Step 6: Start với PM2

```bash
# Start backend
cd /var/www/shoptiktok1/backend
pm2 start index.js --name tiktokshop-backend

# Start frontend
cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name tiktokshop-frontend

# Save PM2 config
pm2 save

# Auto-start PM2 on boot
pm2 startup
# Copy và chạy lệnh mà PM2 suggest
```

### Step 7: Configure Nginx

```bash
# Tạo Nginx config
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

    # Health check endpoint
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

# Test config
nginx -t

# Reload Nginx
systemctl reload nginx
```

### Step 8: Configure Firewall

```bash
# Allow ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS

# Enable firewall (nếu chưa bật)
ufw --force enable
```

### Step 9: Setup SSL Certificate

```bash
# Đảm bảo DNS đã propagate (chờ 5-30 phút sau khi config DNS)
# Test DNS:
nslookup ttshoptool.fun

# Install SSL certificate
certbot --nginx -d ttshoptool.fun -d www.ttshoptool.fun \
  --email seringuyen0506@gmail.com \
  --agree-tos \
  --non-interactive

# Auto-renew setup (Certbot tự động tạo)
certbot renew --dry-run
```

### Step 10: Verify deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Check Nginx
systemctl status nginx

# Test website
curl http://ttshoptool.fun
curl https://ttshoptool.fun
```

## Management Commands

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs
pm2 logs tiktokshop-backend
pm2 logs tiktokshop-frontend

# Restart services
pm2 restart tiktokshop-backend
pm2 restart tiktokshop-frontend
pm2 restart all

# Stop services
pm2 stop all

# Monitor
pm2 monit
```

### Update Code
```bash
cd /var/www/shoptiktok1

# Pull latest changes
git pull origin wip/proxy-debug-2025-10-22

# Reinstall dependencies if needed
cd backend && npm install
cd ../frontend && npm install

# Restart services
pm2 restart all
```

### Nginx Commands
```bash
# Test config
nginx -t

# Reload
systemctl reload nginx

# Restart
systemctl restart nginx

# View logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### SSL Certificate Renewal
```bash
# Manual renew
certbot renew

# Test renewal
certbot renew --dry-run
```

## Troubleshooting

### Port đã được sử dụng
```bash
# Check what's using port 3000
lsof -i :3000
netstat -tulpn | grep 3000

# Kill process
kill -9 PID
```

### PM2 không start
```bash
# Clear PM2 cache
pm2 kill
pm2 start ...
```

### Nginx 502 Bad Gateway
```bash
# Check backend is running
pm2 status

# Check Nginx error log
tail -f /var/log/nginx/error.log

# Restart services
pm2 restart all
systemctl restart nginx
```

### DNS không resolve
```bash
# Check DNS
nslookup ttshoptool.fun
dig ttshoptool.fun

# Đợi DNS propagate (5-30 phút)
# Check tại: https://dnschecker.org
```

## Security Recommendations

### 1. Change SSH Port (Optional)
```bash
# Edit SSH config
nano /etc/ssh/sshd_config
# Change Port 22 to Port 2222

# Restart SSH
systemctl restart sshd

# Update firewall
ufw allow 2222
ufw delete allow 22
```

### 2. Disable Root Login
```bash
# Create sudo user first
adduser yourusername
usermod -aG sudo yourusername

# Edit SSH config
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Restart SSH
systemctl restart sshd
```

### 3. Setup Fail2Ban
```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

## Hostinger-Specific Notes

### hPanel Integration
- Hostinger VPS có hPanel để quản lý
- SSH credentials trong VPS Management
- DNS Zone editor trong Domain Management
- SSL certificate có thể setup qua hPanel hoặc command line

### Backup
- Hostinger có auto-backup trong hPanel
- Recommend: Setup PM2 logs rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Monitoring
```bash
# Install htop
apt install -y htop

# Monitor resources
htop

# Check disk space
df -h

# Check memory
free -h
```

## Post-Deployment Checklist

- [ ] Website accessible at https://ttshoptool.fun
- [ ] SSL certificate valid (green lock)
- [ ] PM2 services running
- [ ] Nginx configured correctly
- [ ] Firewall rules active
- [ ] DNS propagated
- [ ] Auto-start on reboot tested
- [ ] Logs rotation configured
- [ ] Backup strategy in place

## Support

- **Hostinger Support**: https://www.hostinger.com/contact
- **VPS Management**: hPanel → VPS
- **DNS Management**: hPanel → Domains → DNS Zone

---

**Deployment Date**: {{ DATE }}  
**Last Updated**: {{ DATE }}  
**Status**: Production Ready
