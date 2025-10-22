# ============================================
# AUTO DEPLOY TO VPS - PowerShell Script
# ============================================

$VPS_IP = "148.230.100.21"
$VPS_USER = "root"
$REPO_URL = "https://github.com/seringuyen0506-svg/shoptiktok1.git"
$BRANCH = "wip/proxy-debug-2025-10-22"

Write-Host "🚀 DEPLOYING TIKTOK SHOP CRAWLER TO VPS" -ForegroundColor Green
Write-Host "VPS: $VPS_IP" -ForegroundColor Cyan
Write-Host "Branch: $BRANCH" -ForegroundColor Cyan
Write-Host ""

# ============================================
# BƯỚC 1: PUSH CODE LÊN GITHUB
# ============================================

Write-Host "📤 Step 1: Pushing code to GitHub..." -ForegroundColor Yellow

cd "c:\Users\TIEN DUNG\Documents\TikTokShop"

git add .
git commit -m "Production deployment $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git push origin $BRANCH

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Code pushed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Git push failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# BƯỚC 2: DEPLOY TO VPS
# ============================================

Write-Host "🔧 Step 2: Deploying to VPS..." -ForegroundColor Yellow
Write-Host "⚠️  You will be prompted for VPS password" -ForegroundColor Yellow
Write-Host ""

# Tạo deployment script
$DEPLOY_SCRIPT = @"
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Navigate to app directory
cd /var/www/shoptiktok1 || {
    echo "❌ App directory not found. Cloning repo..."
    cd /var/www
    git clone $REPO_URL
    cd shoptiktok1
}

# Pull latest code
echo "📥 Pulling latest code..."
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --production

echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install --production

# Restart with PM2
echo "🔄 Restarting services..."
pm2 restart tiktok-backend || pm2 start index.js --name tiktok-backend --cwd /var/www/shoptiktok1/backend
pm2 restart tiktok-frontend || pm2 start unified-server.js --name tiktok-frontend --cwd /var/www/shoptiktok1/frontend

# Save PM2 config
pm2 save

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
pm2 status

echo ""
echo "🌐 Access your app at: http://$VPS_IP:3000"
echo ""
"@

# Save script to temp file
$TEMP_SCRIPT = "deploy_temp.sh"
$DEPLOY_SCRIPT | Out-File -FilePath $TEMP_SCRIPT -Encoding UTF8

# Upload script to VPS
Write-Host "📤 Uploading deployment script..." -ForegroundColor Cyan
scp $TEMP_SCRIPT ${VPS_USER}@${VPS_IP}:/tmp/deploy.sh

# Execute deployment
Write-Host "▶️  Executing deployment on VPS..." -ForegroundColor Cyan
ssh ${VPS_USER}@${VPS_IP} "chmod +x /tmp/deploy.sh && /tmp/deploy.sh"

# Cleanup
Remove-Item $TEMP_SCRIPT

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your app is running at:" -ForegroundColor Cyan
Write-Host "   http://$VPS_IP:3000" -ForegroundColor White
Write-Host ""
Write-Host "📊 Check status:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 status'" -ForegroundColor White
Write-Host ""
Write-Host "📋 View logs:" -ForegroundColor Cyan
Write-Host "   ssh $VPS_USER@$VPS_IP 'pm2 logs'" -ForegroundColor White
Write-Host ""
