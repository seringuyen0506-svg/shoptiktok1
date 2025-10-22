#!/usr/bin/env pwsh
# ============================================
# ONE-COMMAND DEPLOYMENT TO HOSTINGER VPS
# Chạy: .\deploy-all.ps1
# ============================================

param(
    [string]$VPS_IP = "148.230.100.21",
    [string]$VPS_USER = "root",
    [string]$DOMAIN = "ttshoptool.fun",
    [string]$EMAIL = "seringuyen0506@gmail.com"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   ONE-COMMAND DEPLOYMENT TO HOSTINGER VPS  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "VPS IP    : $VPS_IP" -ForegroundColor Yellow
Write-Host "Domain    : $DOMAIN" -ForegroundColor Yellow
Write-Host "User      : $VPS_USER" -ForegroundColor Yellow
Write-Host "Email     : $EMAIL" -ForegroundColor Yellow
Write-Host ""

# ============================================
# STEP 1: Push code to GitHub
# ============================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "📤 STEP 1/3: Pushing code to GitHub..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

git add .
$commitMsg = "Deploy to $DOMAIN - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMsg -a 2>$null
git push origin wip/proxy-debug-2025-10-22

Write-Host "✅ Code pushed successfully!" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 2: Create deployment script
# ============================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "📝 STEP 2/3: Creating deployment script..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

$BASH_SCRIPT = @"
#!/bin/bash
set -e

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║     DEPLOYING TO HOSTINGER VPS             ║"
echo "║     Domain: $DOMAIN                        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Update system
echo "📦 [1/12] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "📦 [2/12] Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs -qq
else
    echo "✅ [2/12] Node.js already installed: \$(node -v)"
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 [3/12] Installing PM2..."
    npm install -g pm2 --silent
else
    echo "✅ [3/12] PM2 already installed"
fi

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 [4/12] Installing Nginx..."
    apt-get install -y nginx -qq
else
    echo "✅ [4/12] Nginx already installed"
fi

# Install Certbot
if ! command -v certbot &> /dev/null; then
    echo "📦 [5/12] Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx -qq
else
    echo "✅ [5/12] Certbot already installed"
fi

# Clone or update repository
if [ ! -d "/var/www/shoptiktok1" ]; then
    echo "📥 [6/12] Cloning repository..."
    mkdir -p /var/www
    cd /var/www
    git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
    cd shoptiktok1
    git checkout wip/proxy-debug-2025-10-22
else
    echo "🔄 [6/12] Updating repository..."
    cd /var/www/shoptiktok1
    git fetch origin
    git checkout wip/proxy-debug-2025-10-22
    git pull origin wip/proxy-debug-2025-10-22
fi

# Install backend dependencies
echo "📦 [7/12] Installing backend dependencies..."
cd /var/www/shoptiktok1/backend
npm install --production --silent

# Install frontend dependencies
echo "📦 [8/12] Installing frontend dependencies..."
cd /var/www/shoptiktok1/frontend
npm install --production --silent

# Configure environment
echo "⚙️  [9/12] Configuring environment..."
cd /var/www/shoptiktok1
cat > .env << 'ENVEOF'
ALLOW_ORIGINS=https://$DOMAIN,http://$DOMAIN
NODE_ENV=production
ENVEOF

# Start services with PM2
echo "🚀 [10/12] Starting services with PM2..."
pm2 delete tiktokshop-backend 2>/dev/null || true
pm2 delete tiktokshop-frontend 2>/dev/null || true

cd /var/www/shoptiktok1/backend
pm2 start index.js --name tiktokshop-backend

cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name tiktokshop-frontend

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | grep -v "PM2" | bash || true

# Configure Nginx
echo "🌐 [11/12] Configuring Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN << 'NGINXEOF'
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Configure firewall
echo "🔐 [12/12] Configuring firewall..."
ufw allow 22 2>/dev/null || true
ufw allow 80 2>/dev/null || true
ufw allow 443 2>/dev/null || true
ufw --force enable 2>/dev/null || true

# Show status
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          DEPLOYMENT COMPLETED!             ║"
echo "╚════════════════════════════════════════════╝"
echo ""
pm2 status
echo ""
echo "🌐 Website running at: http://$DOMAIN"
echo "🌐 Direct access: http://$VPS_IP:3000"
echo ""

# Check DNS
echo "🔍 Checking DNS configuration..."
DNS_IP=\$(dig +short $DOMAIN @8.8.8.8 | tail -1)
SERVER_IP=\$(curl -s ifconfig.me)

if [ "\$DNS_IP" = "\$SERVER_IP" ]; then
    echo "✅ DNS configured correctly!"
    echo ""
    echo "🔐 Setting up SSL certificate..."
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect
    echo ""
    echo "✅ SSL certificate installed!"
    echo "🌐 Website: https://$DOMAIN"
else
    echo "⚠️  DNS not configured yet"
    echo "   Domain points to: \$DNS_IP"
    echo "   Server IP: \$SERVER_IP"
    echo ""
    echo "📋 Configure DNS in Hostinger hPanel:"
    echo "   1. Login: https://hpanel.hostinger.com"
    echo "   2. Go to: Domains → $DOMAIN → DNS Zone"
    echo "   3. Add A Record: @ → \$SERVER_IP"
    echo "   4. Add A Record: www → \$SERVER_IP"
    echo ""
    echo "   After DNS propagates, run:"
    echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL DONE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
"@

# Convert to Unix line endings and save
$TEMP_SCRIPT = "$env:TEMP\deploy_complete.sh"
$BASH_SCRIPT -replace "`r`n","`n" | Out-File -FilePath $TEMP_SCRIPT -Encoding UTF8 -NoNewline

Write-Host "✅ Deployment script created!" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 3: Execute deployment
# ============================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🚀 STEP 3/3: Deploying to VPS..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  You will be prompted for VPS password twice:" -ForegroundColor Yellow
Write-Host "   1. To upload the script" -ForegroundColor Yellow
Write-Host "   2. To execute the script" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Get password from Hostinger hPanel → VPS → SSH Access" -ForegroundColor Cyan
Write-Host ""

# Upload script
Write-Host "📤 Uploading deployment script to VPS..." -ForegroundColor Cyan
scp $TEMP_SCRIPT ${VPS_USER}@${VPS_IP}:/tmp/deploy_complete.sh

# Execute script
Write-Host ""
Write-Host "▶️  Executing deployment on VPS..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
ssh -t ${VPS_USER}@${VPS_IP} "chmod +x /tmp/deploy_complete.sh && bash /tmp/deploy_complete.sh"

# Cleanup
Remove-Item $TEMP_SCRIPT -ErrorAction SilentlyContinue

# ============================================
# SUCCESS MESSAGE
# ============================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     🎉 DEPLOYMENT SUCCESSFUL! 🎉           ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your website is now live at:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   • http://$DOMAIN" -ForegroundColor White
Write-Host "   • http://$VPS_IP:3000 (direct access)" -ForegroundColor White
Write-Host ""
Write-Host "📊 Management Commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Check status:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 status'" -ForegroundColor White
Write-Host ""
Write-Host "   View logs:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 logs'" -ForegroundColor White
Write-Host ""
Write-Host "   Restart services:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 restart all'" -ForegroundColor White
Write-Host ""
Write-Host "   Monitor resources:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 monit'" -ForegroundColor White
Write-Host ""
Write-Host "🔄 To redeploy after making changes:" -ForegroundColor Yellow
Write-Host "   .\deploy-all.ps1" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✨ Happy coding! ✨" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
