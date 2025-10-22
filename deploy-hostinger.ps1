# ============================================
# DEPLOY TO HOSTINGER VPS - TTSHOPTOOL.FUN
# Run this on Windows PowerShell
# ============================================

param(
    [string]$VPS_IP = "",
    [string]$VPS_USER = "root",
    [string]$DOMAIN = "ttshoptool.fun"
)

# Get VPS IP if not provided
if ($VPS_IP -eq "") {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "   HOSTINGER VPS DEPLOYMENT" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please get your VPS IP from Hostinger hPanel:" -ForegroundColor Yellow
    Write-Host "1. Login to hPanel: https://hpanel.hostinger.com" -ForegroundColor White
    Write-Host "2. Go to: VPS -> Your VPS" -ForegroundColor White
    Write-Host "3. Copy the IP address" -ForegroundColor White
    Write-Host ""
    $VPS_IP = Read-Host "Enter your Hostinger VPS IP"
    
    if ($VPS_IP -eq "") {
        Write-Host "Error: VPS IP is required!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  DEPLOYING TO HOSTINGER VPS" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "VPS IP: $VPS_IP" -ForegroundColor Cyan
Write-Host "Domain: $DOMAIN" -ForegroundColor Cyan
Write-Host "User: $VPS_USER" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 1: Push code to GitHub
# ============================================
Write-Host "Step 1: Pushing code to GitHub..." -ForegroundColor Yellow

git add .
git commit -m "Deploy to Hostinger VPS - ttshoptool.fun" -a
git push origin wip/proxy-debug-2025-10-22

Write-Host "Code pushed to GitHub successfully!" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 2: Create deployment script
# ============================================
Write-Host "Step 2: Creating deployment script..." -ForegroundColor Yellow

$DEPLOY_SCRIPT = @'
#!/bin/bash
set -e

echo ""
echo "================================================"
echo "  DEPLOYING TO HOSTINGER VPS"
echo "  Domain: ttshoptool.fun"
echo "================================================"
echo ""

# Update system
echo "[1/10] Updating system..."
apt update -qq

# Install Node.js if not exists
if ! command -v node &> /dev/null; then
    echo "[2/10] Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[2/10] Node.js already installed: $(node -v)"
fi

# Install PM2 if not exists
if ! command -v pm2 &> /dev/null; then
    echo "[3/10] Installing PM2..."
    npm install -g pm2
else
    echo "[3/10] PM2 already installed"
fi

# Install Nginx if not exists
if ! command -v nginx &> /dev/null; then
    echo "[4/10] Installing Nginx..."
    apt install -y nginx
else
    echo "[4/10] Nginx already installed"
fi

# Install Certbot if not exists
if ! command -v certbot &> /dev/null; then
    echo "[5/10] Installing Certbot..."
    apt install -y certbot python3-certbot-nginx
else
    echo "[5/10] Certbot already installed"
fi

# Clone or update repository
if [ ! -d "/var/www/shoptiktok1" ]; then
    echo "[6/10] Cloning repository (first time)..."
    mkdir -p /var/www
    cd /var/www
    git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
    cd shoptiktok1
    git checkout wip/proxy-debug-2025-10-22
else
    echo "[6/10] Updating repository..."
    cd /var/www/shoptiktok1
    git fetch origin
    git checkout wip/proxy-debug-2025-10-22
    git pull origin wip/proxy-debug-2025-10-22
fi

# Install dependencies
echo "[7/10] Installing dependencies..."
cd /var/www/shoptiktok1/backend
npm install --production --quiet

cd /var/www/shoptiktok1/frontend
npm install --production --quiet

# Configure environment
echo "[8/10] Configuring environment..."
cd /var/www/shoptiktok1
cat > .env << 'ENVEOF'
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun
NODE_ENV=production
ENVEOF

# Restart services with PM2
echo "[9/10] Starting services with PM2..."
pm2 delete tiktokshop-backend 2>/dev/null || true
pm2 delete tiktokshop-frontend 2>/dev/null || true

cd /var/www/shoptiktok1/backend
pm2 start index.js --name tiktokshop-backend

cd /var/www/shoptiktok1/frontend
pm2 start unified-server.js --name tiktokshop-frontend

pm2 save
pm2 startup | tail -1 | bash || true

# Configure Nginx
echo "[10/10] Configuring Nginx..."
if [ ! -f "/etc/nginx/sites-available/ttshoptool.fun" ]; then
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

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINXEOF

    ln -sf /etc/nginx/sites-available/ttshoptool.fun /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
else
    echo "Nginx already configured"
fi

# Configure firewall
echo "Configuring firewall..."
ufw allow 22 2>/dev/null || true
ufw allow 80 2>/dev/null || true
ufw allow 443 2>/dev/null || true

# Show status
echo ""
echo "================================================"
echo "  DEPLOYMENT COMPLETED!"
echo "================================================"
echo ""
pm2 status
echo ""
echo "Website: http://ttshoptool.fun"
echo ""
echo "Next steps:"
echo "1. Configure DNS in Hostinger hPanel"
echo "2. Wait for DNS propagation (5-30 minutes)"
echo "3. Setup SSL certificate"
echo ""
'@

# Save script to temp file
$TEMP_SCRIPT = "$env:TEMP\deploy_hostinger.sh"
$DEPLOY_SCRIPT | Out-File -FilePath $TEMP_SCRIPT -Encoding UTF8 -NoNewline

Write-Host "Deployment script created!" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 3: Upload and execute script
# ============================================
Write-Host "Step 3: Deploying to VPS..." -ForegroundColor Yellow
Write-Host "You will be prompted for VPS password (get it from Hostinger hPanel)" -ForegroundColor Cyan
Write-Host ""

# Upload script
Write-Host "Uploading deployment script..." -ForegroundColor Cyan
scp $TEMP_SCRIPT ${VPS_USER}@${VPS_IP}:/tmp/deploy.sh

# Execute script
Write-Host "Executing deployment..." -ForegroundColor Cyan
Write-Host ""
ssh ${VPS_USER}@${VPS_IP} "chmod +x /tmp/deploy.sh && bash /tmp/deploy.sh"

# Cleanup
Remove-Item $TEMP_SCRIPT -ErrorAction SilentlyContinue

# ============================================
# SUCCESS MESSAGE
# ============================================
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your app is running at:" -ForegroundColor Cyan
Write-Host "  http://$DOMAIN" -ForegroundColor White
Write-Host "  http://$VPS_IP:3000" -ForegroundColor White
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Configure DNS in Hostinger hPanel:" -ForegroundColor Cyan
Write-Host "   - Login: https://hpanel.hostinger.com" -ForegroundColor White
Write-Host "   - Go to: Domains -> $DOMAIN -> DNS Zone" -ForegroundColor White
Write-Host "   - Add A Record: @ -> $VPS_IP" -ForegroundColor White
Write-Host "   - Add A Record: www -> $VPS_IP" -ForegroundColor White
Write-Host ""
Write-Host "2. Wait for DNS propagation (5-30 minutes)" -ForegroundColor Cyan
Write-Host "   - Check at: https://dnschecker.org" -ForegroundColor White
Write-Host ""
Write-Host "3. Setup SSL Certificate:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP" -ForegroundColor White
Write-Host "   certbot --nginx -d $DOMAIN -d www.$DOMAIN --email seringuyen0506@gmail.com --agree-tos --non-interactive" -ForegroundColor White
Write-Host ""
Write-Host "MANAGEMENT COMMANDS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Check status:" -ForegroundColor Cyan
Write-Host "  ssh $VPS_USER@$VPS_IP 'pm2 status'" -ForegroundColor White
Write-Host ""
Write-Host "View logs:" -ForegroundColor Cyan
Write-Host "  ssh $VPS_USER@$VPS_IP 'pm2 logs'" -ForegroundColor White
Write-Host ""
Write-Host "Restart services:" -ForegroundColor Cyan
Write-Host "  ssh $VPS_USER@$VPS_IP 'pm2 restart all'" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
