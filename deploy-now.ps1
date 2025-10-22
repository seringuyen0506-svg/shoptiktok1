# ============================================
# DEPLOY TRỰC TIẾP LÊN VPS - TTSHOPTOOL.FUN
# Chạy script này trên Windows PowerShell
# ============================================

$VPS_IP = "148.230.100.21"
$VPS_USER = "root"
$DOMAIN = "ttshoptool.fun"

Write-Host ""
Write-Host "🚀 DEPLOYING TO TTSHOPTOOL.FUN" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "VPS: $VPS_IP" -ForegroundColor Cyan
Write-Host "Domain: $DOMAIN" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 1: Code đã push lên GitHub rồi
# ============================================
Write-Host "✅ Step 1: Code pushed to GitHub" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 2: Deploy to VPS
# ============================================
Write-Host "🔧 Step 2: Deploying to VPS..." -ForegroundColor Yellow
Write-Host "⚠️  You will be prompted for VPS password" -ForegroundColor Yellow
Write-Host ""

# Tạo deployment script
$DEPLOY_SCRIPT = @'
#!/bin/bash
set -e

echo ""
echo "═══════════════════════════════════════"
echo "🚀 Starting Deployment to ttshoptool.fun"
echo "═══════════════════════════════════════"
echo ""

# Check if app directory exists
if [ ! -d "/var/www/shoptiktok1" ]; then
    echo "📦 First time setup..."
    
    # Install Node.js
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    # Install PM2
    echo "📥 Installing PM2..."
    npm install -g pm2
    
    # Install Nginx
    echo "📥 Installing Nginx..."
    apt install -y nginx
    
    # Clone repo
    echo "📥 Cloning repository..."
    mkdir -p /var/www
    cd /var/www
    git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
    cd shoptiktok1
    git checkout wip/proxy-debug-2025-10-22
else
    # Pull latest code
    echo "📥 Pulling latest code..."
    cd /var/www/shoptiktok1
    git fetch origin
    git checkout wip/proxy-debug-2025-10-22
    git pull origin wip/proxy-debug-2025-10-22
fi

# Install dependencies
echo "📦 Installing backend dependencies..."
cd /var/www/shoptiktok1/backend
npm install --production

echo "📦 Installing frontend dependencies..."
cd /var/www/shoptiktok1/frontend
npm install --production

# Configure environment
echo "⚙️  Configuring environment..."
cd /var/www/shoptiktok1
cat > .env << 'ENVEOF'
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun,http://148.230.100.21
NODE_ENV=production
ENVEOF

# Restart with PM2
echo "🔄 Restarting services..."
pm2 delete tiktokshop-backend 2>/dev/null || true
pm2 delete tiktokshop-frontend 2>/dev/null || true

cd /var/www/shoptiktok1/backend
pm2 start index.js --name tiktokshop-backend

cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name tiktokshop-frontend

pm2 save

# Configure Nginx if not exists
if [ ! -f "/etc/nginx/sites-available/ttshoptool.fun" ]; then
    echo "🌐 Configuring Nginx..."
    cat > /etc/nginx/sites-available/ttshoptool.fun << 'NGINXEOF'
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
}
NGINXEOF

    ln -sf /etc/nginx/sites-available/ttshoptool.fun /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
fi

# Open firewall
ufw allow 22 2>/dev/null || true
ufw allow 80 2>/dev/null || true
ufw allow 443 2>/dev/null || true

# Show status
echo ""
echo "═══════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "═══════════════════════════════════════"
echo ""
pm2 status
echo ""
echo "🌐 Your app is running at:"
echo "   http://ttshoptool.fun"
echo "   http://148.230.100.21"
echo ""
echo "📊 Monitor: pm2 monit"
echo "📋 Logs: pm2 logs"
echo ""
'@

# Save script to temp file
$TEMP_SCRIPT = "$env:TEMP\deploy_ttshoptool.sh"
$DEPLOY_SCRIPT | Out-File -FilePath $TEMP_SCRIPT -Encoding UTF8 -NoNewline

Write-Host "📤 Uploading deployment script to VPS..." -ForegroundColor Cyan
scp $TEMP_SCRIPT ${VPS_USER}@${VPS_IP}:/tmp/deploy.sh

Write-Host "▶️  Executing deployment on VPS..." -ForegroundColor Cyan
Write-Host ""
ssh ${VPS_USER}@${VPS_IP} "chmod +x /tmp/deploy.sh && bash /tmp/deploy.sh"

# Cleanup
Remove-Item $TEMP_SCRIPT -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your app is now live at:" -ForegroundColor Cyan
Write-Host "   http://$DOMAIN" -ForegroundColor White
Write-Host "   http://$VPS_IP:3000" -ForegroundColor White
Write-Host ""
Write-Host "📊 Check status:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 status'" -ForegroundColor White
Write-Host ""
Write-Host "📋 View logs:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 logs'" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Setup SSL (run on VPS):" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP" -ForegroundColor White
Write-Host "   certbot --nginx -d $DOMAIN -d www.$DOMAIN --email seringuyen0506@gmail.com --agree-tos --non-interactive" -ForegroundColor White
Write-Host ""
