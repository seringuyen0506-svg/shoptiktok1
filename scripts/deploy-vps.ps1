Param(
  [Parameter(Mandatory=$true)] [string]$Host,
  [Parameter(Mandatory=$true)] [string]$Domain,
  [Parameter(Mandatory=$true)] [string]$Email,
  [string]$RepoUrl = "https://github.com/seringuyen0506-svg/shoptiktok1.git",
  [string]$Branch = "master"
)

# Purpose: One-shot deploy to a Docker-capable VPS with Let's Encrypt SSL
# Usage: ./scripts/deploy-vps.ps1 -Host 148.230.100.21 -Domain ttshoptool.fun -Email seringuyen0506@gmail.com

$ErrorActionPreference = 'Stop'

function Invoke-SSH {
  param([string]$Cmd)
  ssh "root@$Host" $Cmd
}

Write-Host "==> Ensuring docker-compose volumes and webroot on host..." -ForegroundColor Cyan
Invoke-SSH "mkdir -p /opt/tiktokshop && mkdir -p /opt/certbot-webroot/.well-known/acme-challenge" | Out-Null

Write-Host "==> Installing prerequisites (Docker, Compose, Git) if missing..." -ForegroundColor Cyan
Invoke-SSH "sh -lc 'if ! command -v docker >/dev/null 2>&1; then apt-get update -y && apt-get install -y docker.io docker-compose-plugin git && systemctl enable --now docker; fi'"

Write-Host "==> (Optional) Open firewall ports 80/443 if UFW is active..." -ForegroundColor Cyan
Invoke-SSH "sh -lc 'if command -v ufw >/dev/null 2>&1; then ufw status | grep -q active && (ufw allow 80/tcp; ufw allow 443/tcp) || true; fi'"

Write-Host "==> Cloning or pulling repo..." -ForegroundColor Cyan
Invoke-SSH "cd /opt/tiktokshop && if [ ! -d .git ]; then git clone $RepoUrl .; else git fetch --all && git reset --hard origin/$Branch; fi && git checkout $Branch"

Write-Host "==> Writing .env..." -ForegroundColor Cyan
Invoke-SSH "cd /opt/tiktokshop && printf 'ALLOW_ORIGINS=https://$Domain,http://localhost:3000\n' > .env"

Write-Host "==> Building and starting stack (HTTP)..." -ForegroundColor Cyan
Invoke-SSH "cd /opt/tiktokshop && docker compose up -d --build"

Write-Host "==> Copying initial ACME file to volume..." -ForegroundColor Cyan
Invoke-SSH "sh -lc 'mkdir -p /opt/certbot-webroot/.well-known/acme-challenge && echo ok > /opt/certbot-webroot/.well-known/acme-challenge/ping'"

Write-Host "==> Testing HTTP health..." -ForegroundColor Cyan
Invoke-SSH "curl -sf http://127.0.0.1/api/health || true"

Write-Host "==> Installing certbot (if missing) and issuing certificate..." -ForegroundColor Cyan
Invoke-SSH "apt-get update -y && apt-get install -y certbot && certbot certonly --webroot -w /opt/certbot-webroot -d $Domain -m $Email --agree-tos --non-interactive" || Write-Host "Certbot attempt failed, ensure DNS is pointed and HTTP is reachable" -ForegroundColor Yellow

Write-Host "==> Switching to HTTPS config and exposing 443..." -ForegroundColor Cyan
Invoke-SSH "cd /opt/tiktokshop && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"

Write-Host "==> Final health check (HTTPS)..." -ForegroundColor Cyan
Invoke-SSH "curl -skf https://$Domain/api/health || true"

Write-Host "Done. Visit: https://$Domain/" -ForegroundColor Green
