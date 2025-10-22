# Deploy to Production - Quick Commands

# ============================================
# OPTION 1: PUSH TO GITHUB (Recommended)
# ============================================

# Check git status
git status

# Add all changes
git add .

# Commit
git commit -m "Production ready v1.0.0 - Complete system with AI analysis, shop crawl, and professional UI"

# Push to GitHub
git push origin main

# Or if on different branch:
# git push origin wip/proxy-debug-2025-10-22


# ============================================
# OPTION 2: DEPLOY TO VPS (After git push)
# ============================================

# SSH to VPS
ssh user@your-vps-ip

# Clone repo
cd /var/www
git clone https://github.com/seringuyen0506-svg/shoptiktok1.git
cd shoptiktok1

# Configure environment
cp .env.example .env
nano .env
# Edit: ALLOW_ORIGINS=https://yourdomain.com

# Deploy with Docker
docker compose up -d

# Or deploy with PM2
cd backend && npm install
cd ../frontend && npm install
pm2 start backend/index.js --name tts-backend
pm2 start frontend/unified-server.js --name tts-frontend
pm2 save


# ============================================
# OPTION 3: LOCAL TESTING BEFORE DEPLOY
# ============================================

# Start backend (Terminal 1)
cd backend
$env:PORT="5000"
node index.js

# Start frontend (Terminal 2)
cd frontend  
$env:PORT="3000"
node unified-server.js

# Access app
# http://localhost:3000


# ============================================
# VERIFICATION COMMANDS
# ============================================

# Check health
curl http://localhost/health
curl http://localhost/api/health

# Check Docker containers
docker ps

# Check logs
docker logs tts-backend
docker logs tts-frontend

# Check PM2 status
pm2 status
pm2 logs
