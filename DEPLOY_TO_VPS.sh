# ============================================
# DEPLOY TIKTOK SHOP CRAWLER LÊN VPS
# VPS: Ubuntu 24.04 LTS - Indonesia Jakarta
# IP: ssh root@148.230.100.21
# ============================================

# ============================================
# BƯỚC 1: PUSH CODE LÊN GITHUB TRƯỚC
# ============================================

# Chạy trên máy local (Windows):
cd "c:\Users\TIEN DUNG\Documents\TikTokShop"
git add .
git commit -m "Production ready v1.0.0"
git push origin wip/proxy-debug-2025-10-22

# ============================================
# BƯỚC 2: SSH VÀO VPS
# ============================================

# Mở PowerShell và SSH:
ssh root@148.230.100.21

# Nhập password khi được hỏi

# ============================================
# BƯỚC 3: CÀI ĐẶT MÔI TRƯỜNG (Chỉ lần đầu)
# ============================================

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version

# Install Git
sudo apt install git -y

# Install Docker (optional, nếu muốn dùng Docker)
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker

# Install PM2 (process manager)
sudo npm install -g pm2

# ============================================
# BƯỚC 4: CLONE CODE TỪ GITHUB
# ============================================

# Tạo thư mục cho app
cd /var/www
sudo mkdir -p /var/www

# Clone repo
sudo git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1

# Hoặc nếu đã clone rồi thì pull:
# cd /var/www/shoptiktok1
# sudo git pull origin wip/proxy-debug-2025-10-22

# ============================================
# BƯỚC 5: CÀI ĐẶT DEPENDENCIES
# ============================================

# Backend
cd /var/www/shoptiktok1/backend
sudo npm install

# Frontend
cd /var/www/shoptiktok1/frontend
sudo npm install

# ============================================
# BƯỚC 6: CẤU HÌNH ENVIRONMENT
# ============================================

cd /var/www/shoptiktok1

# Tạo file .env
sudo cp .env.example .env
sudo nano .env

# Sửa file .env:
# ALLOW_ORIGINS=http://148.230.100.21,http://your-domain.com
# PORT=5000

# Save: Ctrl+O, Enter, Ctrl+X

# ============================================
# OPTION A: CHẠY VỚI PM2 (Khuyên dùng)
# ============================================

# Start backend
cd /var/www/shoptiktok1/backend
pm2 start index.js --name tiktok-backend

# Start frontend
cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name tiktok-frontend

# Save PM2 config
pm2 save
pm2 startup
# Copy command hiển thị và chạy nó

# Check status
pm2 status
pm2 logs

# ============================================
# OPTION B: CHẠY VỚI DOCKER
# ============================================

cd /var/www/shoptiktok1

# Build và start
sudo docker compose up -d --build

# Check status
sudo docker ps

# View logs
sudo docker logs tts-backend
sudo docker logs tts-frontend

# ============================================
# BƯỚC 7: MỞ FIREWALL
# ============================================

# Mở port cho frontend (port 3000 hoặc 80)
sudo ufw allow 3000
sudo ufw allow 80
sudo ufw allow 443  # Cho HTTPS
sudo ufw allow 22   # SSH
sudo ufw enable

# ============================================
# BƯỚC 8: TRUY CẬP APP
# ============================================

# Mở browser và truy cập:
# http://148.230.100.21:3000

# Hoặc nếu dùng Docker (port 80):
# http://148.230.100.21

# ============================================
# BƯỚC 9: SETUP NGINX REVERSE PROXY (Optional)
# ============================================

# Install Nginx
sudo apt install nginx -y

# Tạo config
sudo nano /etc/nginx/sites-available/tiktokshop

# Paste config sau:
# server {
#     listen 80;
#     server_name 148.230.100.21;
#
#     location / {
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_cache_bypass $http_upgrade;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#     }
# }

# Enable site
sudo ln -s /etc/nginx/sites-available/tiktokshop /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Bây giờ truy cập: http://148.230.100.21 (không cần port 3000)

# ============================================
# BƯỚC 10: SETUP SSL VỚI LET'S ENCRYPT (Nếu có domain)
# ============================================

# Cần domain trỏ về 148.230.100.21

# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run

# ============================================
# QUẢN LÝ APP
# ============================================

# PM2 Commands:
pm2 restart all          # Restart app
pm2 stop all            # Stop app
pm2 delete all          # Remove app
pm2 logs                # View logs
pm2 monit               # Monitor

# Docker Commands:
sudo docker compose restart
sudo docker compose stop
sudo docker compose down
sudo docker compose logs -f

# Update code:
cd /var/www/shoptiktok1
sudo git pull origin wip/proxy-debug-2025-10-22
pm2 restart all
# Or: sudo docker compose up -d --build

# ============================================
# TROUBLESHOOTING
# ============================================

# Check if port is open:
sudo netstat -tulpn | grep :3000

# Check PM2 logs:
pm2 logs tiktok-backend --lines 100

# Check Docker logs:
sudo docker logs tts-backend --tail 100

# Test API:
curl http://localhost:5000/health
curl http://localhost:3000/health

# Check disk space:
df -h

# Check memory:
free -h
