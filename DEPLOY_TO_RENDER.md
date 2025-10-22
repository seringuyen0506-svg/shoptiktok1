# ============================================
# DEPLOY LÊN RENDER.COM
# ============================================

# Email đăng ký: seringuyen0506@gmail.com
# Dashboard: https://dashboard.render.com

# ============================================
# BƯỚC 1: PUSH CODE LÊN GITHUB
# ============================================

cd "c:\Users\TIEN DUNG\Documents\TikTokShop"

# Add all changes
git add .

# Commit
git commit -m "Production ready - Deploy to Render"

# Push to main branch (Render cần main branch)
git checkout main
git merge wip/proxy-debug-2025-10-22
git push origin main

# Hoặc push trực tiếp nhánh hiện tại:
# git push origin wip/proxy-debug-2025-10-22

# ============================================
# BƯỚC 2: DEPLOY BACKEND LÊN RENDER
# ============================================

# 1. Truy cập: https://dashboard.render.com
# 2. Login với: seringuyen0506@gmail.com
# 3. Click "New +" → "Web Service"
# 4. Connect GitHub repository: seringuyen0506-svg/shoptiktok1
# 5. Configure:
#    - Name: tiktokshop-backend
#    - Root Directory: backend
#    - Environment: Docker
#    - Region: Singapore (gần nhất)
#    - Branch: main (hoặc wip/proxy-debug-2025-10-22)
#    - Docker Build Context: backend
#    - Dockerfile Path: backend/Dockerfile
# 6. Environment Variables:
#    - NODE_ENV=production
#    - ALLOW_ORIGINS=https://tiktokshop-frontend.onrender.com
# 7. Click "Create Web Service"

# ============================================
# BƯỚC 3: DEPLOY FRONTEND LÊN RENDER/VERCEL
# ============================================

# OPTION A: Deploy frontend lên Render (Static Site)
# 1. Dashboard → "New +" → "Static Site"
# 2. Connect repo: shoptiktok1
# 3. Configure:
#    - Name: tiktokshop-frontend
#    - Root Directory: frontend
#    - Build Command: (để trống)
#    - Publish Directory: . (current directory)
# 4. Click "Create Static Site"

# OPTION B: Deploy frontend lên Vercel (Khuyên dùng)
# 1. Truy cập: https://vercel.com
# 2. Login với GitHub
# 3. Click "Add New" → "Project"
# 4. Import: shoptiktok1
# 5. Configure:
#    - Framework Preset: Other
#    - Root Directory: frontend
#    - Build Command: (để trống)
#    - Output Directory: .
# 6. Environment Variables:
#    - BACKEND_URL=https://tiktokshop-backend.onrender.com
# 7. Click "Deploy"

# ============================================
# BƯỚC 4: CẬP NHẬT CORS TRONG BACKEND
# ============================================

# Sau khi có URL frontend, update backend environment variables:
# 1. Vào Render Dashboard → Backend service
# 2. Environment tab
# 3. Add/Update:
#    ALLOW_ORIGINS=https://your-frontend-url.vercel.app,https://tiktokshop-frontend.onrender.com

# ============================================
# URLs SAU KHI DEPLOY
# ============================================

# Backend: https://tiktokshop-backend.onrender.com
# Frontend: https://tiktokshop-frontend.vercel.app (hoặc .onrender.com)

# Test backend health:
# https://tiktokshop-backend.onrender.com/health
# https://tiktokshop-backend.onrender.com/api/health

# ============================================
# CUSTOM DOMAIN (Optional)
# ============================================

# Render:
# 1. Service Settings → Custom Domain
# 2. Add domain: yourdomain.com
# 3. Point DNS: CNAME to onrender.com

# Vercel:
# 1. Project Settings → Domains
# 2. Add domain: yourdomain.com
# 3. Follow DNS configuration

# ============================================
# AUTO DEPLOY SETTINGS
# ============================================

# Render tự động deploy khi push lên GitHub
# Để enable:
# 1. Service Settings → Auto-Deploy
# 2. Enable "Auto-Deploy"
# 3. Mỗi lần git push → tự động deploy

# ============================================
# PERSISTENT DISK (Cho history.json)
# ============================================

# Render Free tier không có persistent disk
# Upgrade to Paid plan:
# 1. Service Settings → Disks
# 2. Add Disk
# 3. Mount Path: /app/backend/data
# 4. Size: 1GB (minimum)

# ============================================
# MONITORING & LOGS
# ============================================

# View logs:
# https://dashboard.render.com → Service → Logs

# View metrics:
# Dashboard → Service → Metrics

# Health checks:
# Settings → Health Check Path: /health

# ============================================
# QUICK DEPLOY CHECKLIST
# ============================================

# ✅ Push code to GitHub
# ✅ Login Render: seringuyen0506@gmail.com
# ✅ Create Backend Web Service (Docker)
# ✅ Create Frontend Static Site (hoặc Vercel)
# ✅ Configure CORS environment variables
# ✅ Test: https://backend-url/health
# ✅ Test: https://frontend-url
# ✅ Enable auto-deploy
# ✅ Done! 🎉
