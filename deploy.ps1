#!/usr/bin/env pwsh
# ONE-COMMAND DEPLOY - Simplified version
param(
    [string]$VPS_IP = "148.230.100.21",
    [string]$DOMAIN = "ttshoptool.fun",
    [string]$EMAIL = "seringuyen0506@gmail.com"
)

Write-Host "🚀 Deploying to $DOMAIN ($VPS_IP)..." -ForegroundColor Cyan

# Push to GitHub
git add .
git commit -m "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -a 2>$null
git push origin wip/proxy-debug-2025-10-22

# Create simple deployment script
$script = @'
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo "🔧 Fixing conflicts and installing..."
# Stop conflicting services
systemctl stop apache2 2>/dev/null || true
killall -9 nginx 2>/dev/null || true

# Install packages
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
apt-get install -y nodejs nginx certbot python3-certbot-nginx -qq 2>/dev/null
npm install -g pm2 2>/dev/null

# Clone/update repo
if [ -d "/var/www/shoptiktok1" ]; then
    cd /var/www/shoptiktok1 && git pull
else
    mkdir -p /var/www
    git clone https://github.com/seringuyen0506-svg/shoptiktok1.git /var/www/shoptiktok1
    cd /var/www/shoptiktok1 && git checkout wip/proxy-debug-2025-10-22
fi

# Install dependencies
cd /var/www/shoptiktok1/backend && npm install --production 2>/dev/null
cd /var/www/shoptiktok1/frontend && npm install --production 2>/dev/null

# Start with PM2
pm2 delete all 2>/dev/null || true
cd /var/www/shoptiktok1/backend && pm2 start index.js --name backend
cd /var/www/shoptiktok1/frontend && pm2 start unified-server.js --name frontend
pm2 save && pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true

# Configure Nginx
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
    }
}
NGINX

systemctl restart nginx

echo "✅ Deployed! Visit http://DOMAIN_PLACEHOLDER"
pm2 status
'@ -replace 'DOMAIN_PLACEHOLDER', $DOMAIN

$tmp = "$env:TEMP\deploy.sh"
$script -replace "`r`n","`n" | Out-File $tmp -Encoding UTF8 -NoNewline

Write-Host "📤 Uploading & executing..." -ForegroundColor Yellow
scp $tmp root@${VPS_IP}:/tmp/deploy.sh
ssh -t root@${VPS_IP} "chmod +x /tmp/deploy.sh && bash /tmp/deploy.sh"

Remove-Item $tmp -Force
Write-Host "✅ Done! Check http://$DOMAIN" -ForegroundColor Green
