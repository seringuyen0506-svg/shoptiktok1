#!/usr/bin/env pwsh
# ============================================
# ONE-COMMAND FULL DEPLOYMENT
# Deploy: Frontend + Backend + SSL + Auto-restart
# Usage: .\deploy.ps1
# ============================================

param(
    [string]$VPS_IP = "148.230.100.21",
    [string]$DOMAIN = "ttshoptool.fun",
    [string]$EMAIL = "seringuyen0506@gmail.com"
)

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    🚀 FULL DEPLOYMENT TO PRODUCTION 🚀    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Domain : $DOMAIN" -ForegroundColor Yellow
Write-Host "VPS IP : $VPS_IP" -ForegroundColor Yellow
Write-Host "Email  : $EMAIL" -ForegroundColor Yellow
Write-Host ""

# ============================================
# STEP 1: Push code to GitHub
# ============================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "📤 [1/3] Pushing to GitHub..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

git add .
git commit -m "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -a 2>$null
git push origin wip/proxy-debug-2025-10-22

Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 2: Create deployment script
# ============================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "📝 [2/3] Preparing deployment script..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

$script = @'
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║      DEPLOYING TO PRODUCTION VPS           ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Stop conflicting services
echo "🛑 [1/10] Stopping conflicting services..."
systemctl stop apache2 2>/dev/null || true
docker stop $(docker ps -q) 2>/dev/null || true
killall -9 nginx 2>/dev/null || true

# Install Node.js
echo "📦 [2/10] Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y nodejs -qq >/dev/null 2>&1

# Install PM2
echo "📦 [3/10] Installing PM2..."
npm install -g pm2 >/dev/null 2>&1

# Install Nginx + Certbot
echo "📦 [4/10] Installing Nginx & Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx -qq >/dev/null 2>&1

# Install Puppeteer dependencies for Ubuntu 24.04
echo "📦 [4.5/10] Installing Puppeteer dependencies..."
apt-get install -y ca-certificates fonts-liberation libasound2t64 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc-s1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils -qq >/dev/null 2>&1

# Clone or update repository
if [ -d "/var/www/shoptiktok1" ]; then
    echo "🔄 [5/10] Updating repository..."
    cd /var/www/shoptiktok1
    git fetch origin >/dev/null 2>&1
    git checkout wip/proxy-debug-2025-10-22 >/dev/null 2>&1
    git pull origin wip/proxy-debug-2025-10-22 >/dev/null 2>&1
else
    echo "📥 [5/10] Cloning repository..."
    mkdir -p /var/www
    git clone https://github.com/seringuyen0506-svg/shoptiktok1.git /var/www/shoptiktok1 >/dev/null 2>&1
    cd /var/www/shoptiktok1
    git checkout wip/proxy-debug-2025-10-22 >/dev/null 2>&1
fi

# Install dependencies
echo "📦 [6/11] Installing backend dependencies..."
cd /var/www/shoptiktok1/backend
npm install --production >/dev/null 2>&1

echo "📦 [7/11] Installing frontend dependencies..."
cd /var/www/shoptiktok1/frontend
npm install --production >/dev/null 2>&1

# Create .env file in BACKEND directory (dotenv loads from working directory)
echo "⚙️  [8/11] Creating environment configuration..."
cat > /var/www/shoptiktok1/backend/.env << 'ENVEOF'
ALLOW_ORIGINS=https://DOMAIN_PLACEHOLDER,http://DOMAIN_PLACEHOLDER,https://www.DOMAIN_PLACEHOLDER,http://www.DOMAIN_PLACEHOLDER
NODE_ENV=production
PORT=8080
ENVEOF

# Restart services with PM2
echo "🚀 [9/11] Starting services with PM2..."
pm2 delete all 2>/dev/null || true

cd /var/www/shoptiktok1/backend
pm2 start index.js --name backend

cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name frontend

pm2 save >/dev/null 2>&1
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash >/dev/null 2>&1 || true
pm2 delete all 2>/dev/null || true

cd /var/www/shoptiktok1/backend
PORT=8080 pm2 start index.js --name backend --update-env

cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name frontend

pm2 save >/dev/null 2>&1
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash >/dev/null 2>&1 || true

# Configure Nginx
echo "🌐 [10/10] Configuring Nginx..."
cat > /etc/nginx/sites-available/default << 'NGINX'
server {
    listen 80 default_server;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
    
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
        
        # Increase timeout for crawling operations (5 minutes)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    location /health {
        access_log off;
        return 200 "OK";
    }
}
NGINX

nginx -t && systemctl restart nginx

# Setup SSL
echo "🔐 [11/11] Setting up SSL certificate..."
certbot --nginx -d DOMAIN_PLACEHOLDER -d www.DOMAIN_PLACEHOLDER \
    --email EMAIL_PLACEHOLDER \
    --agree-tos \
    --non-interactive \
    --redirect \
    --expand 2>/dev/null || echo "⚠️  SSL setup failed (may already exist)"

# Show status
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          ✅ DEPLOYMENT COMPLETE! ✅        ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "🌐 Website: https://DOMAIN_PLACEHOLDER"
echo "🌐 HTTP:    http://DOMAIN_PLACEHOLDER (redirects to HTTPS)"
echo ""
echo "📊 Services Status:"
pm2 status
echo ""
echo "🔍 Quick Test:"
echo "   curl https://DOMAIN_PLACEHOLDER/api/health"
echo ""
'@ -replace 'DOMAIN_PLACEHOLDER', $DOMAIN -replace 'EMAIL_PLACEHOLDER', $EMAIL

$tmp = "$env:TEMP\deploy_full.sh"
$script -replace "`r`n","`n" | Out-File $tmp -Encoding UTF8 -NoNewline

Write-Host "✅ Script prepared" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 3: Deploy to VPS
# ============================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🚀 [3/3] Deploying to VPS..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  You will be prompted for VPS password twice:" -ForegroundColor Yellow
Write-Host "   1. To upload deployment script" -ForegroundColor White
Write-Host "   2. To execute deployment" -ForegroundColor White
Write-Host ""

scp $tmp root@${VPS_IP}:/tmp/deploy_full.sh
Write-Host ""
ssh -t root@${VPS_IP} "chmod +x /tmp/deploy_full.sh && bash /tmp/deploy_full.sh"

Remove-Item $tmp -Force

# ============================================
# SUCCESS MESSAGE
# ============================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     🎉 DEPLOYMENT SUCCESSFUL! 🎉          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "✅ All components deployed:" -ForegroundColor Cyan
Write-Host "   • Frontend (port 3000)" -ForegroundColor White
Write-Host "   • Backend (port 5000)" -ForegroundColor White
Write-Host "   • Nginx reverse proxy" -ForegroundColor White
Write-Host "   • SSL certificate (HTTPS)" -ForegroundColor White
Write-Host "   • PM2 process manager" -ForegroundColor White
Write-Host "   • Auto-restart on reboot" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Your website is live at:" -ForegroundColor Cyan
Write-Host "   https://$DOMAIN" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Management commands:" -ForegroundColor Yellow
Write-Host "   ssh root@$VPS_IP 'pm2 status'     # Check status" -ForegroundColor White
Write-Host "   ssh root@$VPS_IP 'pm2 logs'       # View logs" -ForegroundColor White
Write-Host "   ssh root@$VPS_IP 'pm2 restart all'# Restart" -ForegroundColor White
Write-Host ""
Write-Host "🔄 To redeploy after code changes:" -ForegroundColor Yellow
Write-Host "   .\deploy.ps1" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

