Param(
  [Parameter(Mandatory=$true)] [string]$VpsHost,
  [Parameter(Mandatory=$true)] [string]$Domain,
  [Parameter(Mandatory=$true)] [string]$Email,
  [string]$RepoUrl = "https://github.com/seringuyen0506-svg/shoptiktok1.git",
  [string]$Branch = "master"
)

# Purpose: One-shot deploy to a Docker-capable VPS with Let's Encrypt SSL
# Usage: ./scripts/deploy-vps.ps1 -VpsHost 148.230.100.21 -Domain ttshoptool.fun -Email seringuyen0506@gmail.com

$ErrorActionPreference = 'Stop'

function Invoke-SSH {
  param([string]$Cmd)
  ssh "root@$VpsHost" $Cmd
}

Write-Host "==> Ensuring docker-compose volumes and webroot on host..." -ForegroundColor Cyan
Invoke-SSH "mkdir -p /opt/tiktokshop && mkdir -p /opt/certbot-webroot/.well-known/acme-challenge" | Out-Null

Write-Host "==> Installing prerequisites (curl, git, Docker, Compose) if missing..." -ForegroundColor Cyan
Invoke-SSH "bash -lc 'apt-get update -y && apt-get install -y curl git >/dev/null 2>&1 || true; if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh && systemctl enable --now docker; fi; if ! docker compose version >/dev/null 2>&1; then mkdir -p /usr/local/lib/docker/cli-plugins && curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose; fi'"

Write-Host "==> (Optional) Open firewall ports 80/443 if UFW is active..." -ForegroundColor Cyan
Invoke-SSH "sh -lc 'if command -v ufw >/dev/null 2>&1; then ufw status | grep -q active && (ufw allow 80/tcp; ufw allow 443/tcp) || true; fi'"

Write-Host "==> Cloning or pulling repo..." -ForegroundColor Cyan
Invoke-SSH "cd /opt/tiktokshop && if [ ! -d .git ]; then git clone $RepoUrl .; else git fetch --all && git reset --hard origin/$Branch; fi && git checkout $Branch"

Write-Host "==> Writing .env..." -ForegroundColor Cyan
Invoke-SSH "cd /opt/tiktokshop && printf 'ALLOW_ORIGINS=https://$Domain,http://localhost:3000\n' > .env"

Write-Host "==> Building and starting stack (HTTP)..." -ForegroundColor Cyan
Invoke-SSH "bash -lc 'cd /opt/tiktokshop && if docker compose version >/dev/null 2>&1; then docker compose up -d --build; else docker-compose up -d --build; fi'"

Write-Host "==> Copying initial ACME file to volume..." -ForegroundColor Cyan
Invoke-SSH "bash -lc 'mkdir -p /opt/certbot-webroot/.well-known/acme-challenge && echo ok > /opt/certbot-webroot/.well-known/acme-challenge/ping'"

Write-Host "==> Waiting for Nginx (HTTP) to be ready..." -ForegroundColor Cyan
Invoke-SSH 'bash -lc "i=0; while true; do content=\$(curl -s http://127.0.0.1/.well-known/acme-challenge/ping || true); if [ \"\$content\" = \"ok\" ]; then echo ready; break; fi; i=\$((i+1)); if [ \"\$i\" -ge 60 ]; then echo timeout; exit 1; fi; sleep 2; done"'

Write-Host "==> Testing HTTP health..." -ForegroundColor Cyan
Invoke-SSH "curl -sf http://127.0.0.1/api/health || true"

Write-Host "==> Installing certbot (if missing) and issuing certificate..." -ForegroundColor Cyan
$certCmd = "bash -lc 'set -e; if ! command -v certbot >/dev/null 2>&1; then (apt-get update -y && apt-get install -y certbot) || (snap install core && snap refresh core && snap install --classic certbot && ln -sf /snap/bin/certbot /usr/bin/certbot); fi; certbot certonly --webroot -w /opt/certbot-webroot -d $Domain -m $Email --agree-tos --non-interactive'"
Invoke-SSH $certCmd
if ($LASTEXITCODE -ne 0) {
  Write-Host "Certbot attempt failed, ensure DNS is pointed and HTTP is reachable" -ForegroundColor Yellow
}

Write-Host "==> Switching to HTTPS config and exposing 443..." -ForegroundColor Cyan
Invoke-SSH "bash -lc 'cd /opt/tiktokshop && if docker compose version >/dev/null 2>&1; then docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build; else docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build; fi'"

Write-Host "==> Final health check (HTTPS)..." -ForegroundColor Cyan
Invoke-SSH "curl -skf https://$Domain/api/health || true"

Write-Host "Done. Visit: https://$Domain/" -ForegroundColor Green
