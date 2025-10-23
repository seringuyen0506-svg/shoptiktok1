#!/bin/bash

# ============================================
# TIKTOK SHOP CRAWLER - DEPLOYMENT SCRIPT
# ============================================
# 
# Hỗ trợ deploy lên:
# - VPS/Server (Ubuntu/Debian)
# - Docker/Docker Compose
# - Vercel (Frontend)
#
# Yêu cầu:
# - Docker & Docker Compose installed
# - Git installed
# - Domain đã trỏ về server IP
#
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_warning "Running as root. Consider using a non-root user with sudo."
fi

# ============================================
# 1. CHECK PREREQUISITES
# ============================================
log_info "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    log_info "Visit: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed."
    log_info "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

log_success "Prerequisites check passed!"

# ============================================
# 2. CONFIGURATION
# ============================================
log_info "Setting up configuration..."

# Check if .env exists
if [ ! -f .env ]; then
    log_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    log_info "Please edit .env file with your configuration:"
    log_info "  - Set ALLOW_ORIGINS to your domain"
    log_info "  - Optionally set HMCAPTCHA_API_KEY and DEEPSEEK_API_KEY"
    read -p "Press Enter to continue after editing .env..."
fi

log_success "Configuration ready!"

# ============================================
# 3. BUILD & START SERVICES
# ============================================
log_info "Building and starting services with Docker Compose..."

# Stop existing containers
log_info "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Build images
log_info "Building Docker images..."
docker-compose build --no-cache

# Start services
log_info "Starting services..."
docker-compose up -d

log_success "Services started!"

# ============================================
# 4. HEALTH CHECK
# ============================================
log_info "Performing health check..."

# Wait for services to start
sleep 5

# Check backend
if curl -f http://localhost:8080/health &> /dev/null; then
    log_success "Backend is healthy!"
else
    log_error "Backend health check failed!"
    log_info "Check logs with: docker-compose logs backend"
    exit 1
fi

# Check frontend
if curl -f http://localhost:80 &> /dev/null; then
    log_success "Frontend is healthy!"
else
    log_warning "Frontend health check failed. May need Nginx configuration."
fi

# ============================================
# 5. SHOW STATUS
# ============================================
log_info "Deployment Summary:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_success "✅ Deployment completed successfully!"
echo ""
log_info "Access your application at:"
echo "  Frontend: http://localhost (or your domain)"
echo "  Backend API: http://localhost:8080"
echo "  Health Check: http://localhost:8080/health"
echo ""
log_info "Useful commands:"
echo "  View logs:      docker-compose logs -f"
echo "  Restart:        docker-compose restart"
echo "  Stop:           docker-compose stop"
echo "  Remove:         docker-compose down"
echo "  Rebuild:        docker-compose up -d --build"
echo ""

# ============================================
# 6. OPTIONAL: SSL/HTTPS SETUP
# ============================================
read -p "Do you want to set up SSL/HTTPS with Cloudflare? (y/n): " setup_ssl

if [ "$setup_ssl" = "y" ] || [ "$setup_ssl" = "Y" ]; then
    log_info "SSL/HTTPS Setup:"
    echo ""
    echo "For Cloudflare Tunnel (Recommended for ease):"
    echo "1. Install cloudflared:"
    echo "   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared"
    echo "   chmod +x /usr/local/bin/cloudflared"
    echo ""
    echo "2. Login and create tunnel:"
    echo "   cloudflared tunnel login"
    echo "   cloudflared tunnel create tiktok-shop-crawler"
    echo ""
    echo "3. Configure tunnel to point to localhost:80 (frontend)"
    echo ""
    echo "See CLOUDFLARE_TUNNEL_GUIDE.md for detailed instructions."
    echo ""
fi

# ============================================
# 7. POST-DEPLOYMENT CHECKLIST
# ============================================
log_info "Post-Deployment Checklist:"
echo ""
echo "✓ Check if services are running: docker-compose ps"
echo "✓ Test backend API: curl http://localhost:8080/health"
echo "✓ Test frontend: Open http://localhost in browser"
echo "✓ Configure proxy in UI"
echo "✓ Add hmcaptcha API key in UI (if not in .env)"
echo "✓ Test crawl with 1-2 links"
echo "✓ Monitor logs: docker-compose logs -f backend"
echo ""

log_success "🚀 Deployment script completed!"
log_info "If you encounter issues, check the logs or contact support."
