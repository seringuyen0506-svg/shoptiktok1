# ============================================
# DEPLOY TTSHOPTOOL.FUN LÊN VPS
# ============================================
# VPS IP: 148.230.100.21
# Domain: ttshoptool.fun
# Email: seringuyen0506@gmail.com
# ============================================

# ============================================
# BƯỚC 1: PUSH CODE LÊN GITHUB
# ============================================

cd "c:\Users\TIEN DUNG\Documents\TikTokShop"

# Add all files
git add .

# Commit
git commit -m "Deploy to ttshoptool.fun on VPS 148.230.100.21"

# Push to GitHub
git push origin wip/proxy-debug-2025-10-22

# Hoặc merge vào main:
git checkout main
git merge wip/proxy-debug-2025-10-22
git push origin main

# ============================================
# BƯỚC 2: SSH VÀO VPS
# ============================================

ssh root@148.230.100.21

# ============================================
# BƯỚC 3: SETUP VPS LẦN ĐẦU (Chỉ chạy 1 lần)
# ============================================

# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js
node --version
npm --version

# Install Git
apt install git -y

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx
apt install nginx -y

# Install Certbot (cho SSL)
apt install certbot python3-certbot-nginx -y

# Enable firewall
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable

# ============================================
# BƯỚC 4: CLONE CODE
# ============================================

# Tạo thư mục
mkdir -p /var/www
cd /var/www

# Clone repo
git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1

# Checkout đúng branch
git checkout wip/proxy-debug-2025-10-22
# Hoặc: git checkout main

# ============================================
# BƯỚC 5: CÀI ĐẶT DEPENDENCIES
# ============================================

# Backend
cd /var/www/shoptiktok1/backend
npm install --production

# Frontend
cd /var/www/shoptiktok1/frontend
npm install --production

# ============================================
# BƯỚC 6: CẤU HÌNH ENVIRONMENT
# ============================================

cd /var/www/shoptiktok1

# Tạo .env file
cat > .env << 'EOF'
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun,http://148.230.100.21
NODE_ENV=production
EOF

# Verify .env
cat .env

# ============================================
# BƯỚC 7: START APP VỚI PM2
# ============================================

# Start backend (port 5000)
cd /var/www/shoptiktok1/backend
pm2 start index.js --name tiktokshop-backend

# Start frontend (port 3000) 
cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name tiktokshop-frontend

# Save PM2 config
pm2 save

# Auto-start PM2 on boot
pm2 startup systemd
# Copy và chạy command mà PM2 hiển thị

# Check status
pm2 status
pm2 logs

# ============================================
# BƯỚC 8: CẤU HÌNH NGINX
# ============================================

# Tạo Nginx config cho ttshoptool.fun
cat > /etc/nginx/sites-available/ttshoptool.fun << 'EOF'
server {
    listen 80;
    server_name ttshoptool.fun www.ttshoptool.fun;

    # Redirect HTTP to HTTPS (sau khi có SSL)
    # return 301 https://$server_name$request_uri;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to frontend (port 3000)
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

    # Proxy /api to backend (port 5000) - nếu cần
    # location /api {
    #     proxy_pass http://localhost:5000;
    #     proxy_http_version 1.1;
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    # }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/ttshoptool.fun /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx

# ============================================
# BƯỚC 9: CẤU HÌNH DNS (Làm trên domain provider)
# ============================================

# Truy cập domain provider của ttshoptool.fun
# Thêm DNS records:
# 
# Type: A
# Name: @
# Value: 148.230.100.21
# TTL: 3600
#
# Type: A  
# Name: www
# Value: 148.230.100.21
# TTL: 3600

# Đợi DNS propagate (5-30 phút)
# Check DNS: dig ttshoptool.fun
# Hoặc: nslookup ttshoptool.fun

# ============================================
# BƯỚC 10: CÀI ĐẶT SSL (Let's Encrypt)
# ============================================

# Sau khi DNS đã trỏ đúng về VPS

# Get SSL certificate
certbot --nginx -d ttshoptool.fun -d www.ttshoptool.fun --email seringuyen0506@gmail.com --agree-tos --no-eff-email

# Certbot sẽ tự động:
# 1. Verify domain ownership
# 2. Generate SSL certificate
# 3. Update Nginx config với HTTPS
# 4. Setup auto-renewal

# Test auto-renewal
certbot renew --dry-run

# ============================================
# BƯỚC 11: TEST APP
# ============================================

# Test backend health
curl http://localhost:5000/health
curl http://localhost:5000/api/health

# Test frontend
curl http://localhost:3000/health

# Test từ browser:
# http://ttshoptool.fun (HTTP)
# https://ttshoptool.fun (HTTPS sau khi có SSL)

# ============================================
# QUẢN LÝ APP
# ============================================

# Xem logs
pm2 logs tiktokshop-backend --lines 100
pm2 logs tiktokshop-frontend --lines 100

# Restart app
pm2 restart all

# Stop app
pm2 stop all

# Monitor
pm2 monit

# Update code (khi có thay đổi)
cd /var/www/shoptiktok1
git pull origin wip/proxy-debug-2025-10-22
cd backend && npm install
cd ../frontend && npm install
pm2 restart all

# Check Nginx
systemctl status nginx
nginx -t

# Check SSL expiry
certbot certificates

# ============================================
# BACKUP & RESTORE
# ============================================

# Backup history.json
cp /var/www/shoptiktok1/backend/data/history.json /root/backup/history-$(date +%Y%m%d).json

# Setup cron for daily backup
crontab -e
# Add line:
# 0 2 * * * cp /var/www/shoptiktok1/backend/data/history.json /root/backup/history-$(date +\%Y\%m\%d).json

# ============================================
# MONITORING
# ============================================

# Setup PM2 monitoring
pm2 install pm2-logrotate

# Check resource usage
pm2 status
htop
df -h
free -h

# Check app uptime
pm2 show tiktokshop-backend
pm2 show tiktokshop-frontend

# ============================================
# TROUBLESHOOTING
# ============================================

# If app not working:
# 1. Check PM2 logs
pm2 logs --err

# 2. Check Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# 3. Check ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :5000
netstat -tulpn | grep :80

# 4. Restart everything
pm2 restart all
systemctl restart nginx

# 5. Check firewall
ufw status

# ============================================
# DONE! 🎉
# ============================================

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🌐 Your app is now running at:"
echo "   http://ttshoptool.fun"
echo "   https://ttshoptool.fun (after SSL)"
echo ""
echo "📊 Monitor: pm2 monit"
echo "📋 Logs: pm2 logs"
echo ""
