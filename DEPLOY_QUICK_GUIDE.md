# 🚀 DEPLOYMENT QUICK REFERENCE

## ✅ Pre-Deployment Checklist

### 1. Run Verification Script
```powershell
.\verify-deploy.ps1
```
**Expected**: All checks pass ✅

### 2. Check Current Changes
```powershell
git status
```

### 3. Review Key Files
- ✅ `backend/index.js` - PORT 8080
- ✅ `frontend/unified-server.js` - Proxy to 8080
- ✅ `deploy.ps1` - PORT 8080
- ✅ `.env.example` - PORT 8080

---

## 🚀 DEPLOY NOW

### One Command Deploy
```powershell
.\deploy.ps1
```

**What it does**:
1. ✅ Commits & pushes to GitHub
2. ✅ Uploads deploy script to VPS
3. ✅ Executes deployment on VPS
   - Installs Node.js 20
   - Installs PM2
   - Installs Nginx + Certbot
   - Installs Puppeteer dependencies
   - Clones/updates repo
   - Installs npm dependencies
   - Creates .env with PORT=8080
   - Starts backend (PM2) on port 8080
   - Starts frontend (PM2) on port 3000
   - Configures Nginx reverse proxy
   - Sets up SSL certificate (Let's Encrypt)

**Duration**: ~5-10 minutes

**Password Required**: 
- You'll be prompted for VPS password **twice**
  1. To upload script (scp)
  2. To execute script (ssh)

---

## 📊 Post-Deployment Verification

### 1. Check Services
```powershell
ssh root@148.230.100.21 "pm2 status"
```

**Expected Output**:
```
┌─────┬────────────┬─────────┬─────────┬─────────┐
│ id  │ name       │ status  │ cpu     │ memory  │
├─────┼────────────┼─────────┼─────────┼─────────┤
│ 0   │ backend    │ online  │ 0%      │ 120 MB  │
│ 1   │ frontend   │ online  │ 0%      │ 80 MB   │
└─────┴────────────┴─────────┴─────────┴─────────┘
```

### 2. Check Backend Health
```powershell
curl https://ttshoptool.fun/api/health
```

**Expected**: `{"status":"ok","timestamp":"..."}`

### 3. Check Frontend
Open browser: https://ttshoptool.fun

**Expected**: App loads, no console errors

### 4. Test Crawl
1. Paste product link
2. Click "Crawl"
3. Check results display

---

## 🔧 Troubleshooting

### Backend Not Starting
```bash
ssh root@148.230.100.21
cd /var/www/shoptiktok1/backend
pm2 logs backend --lines 50
```

**Common Issues**:
- Port conflict → Check `.env` has `PORT=8080`
- Missing dependencies → `npm install --production`
- Puppeteer error → Check dependencies installed

### Frontend 502 Error
```bash
ssh root@148.230.100.21
cd /var/www/shoptiktok1/frontend
pm2 logs frontend --lines 50
```

**Common Issues**:
- Backend not running → Check backend status
- Wrong proxy target → Should be `localhost:8080`

### SSL Certificate Failed
```bash
ssh root@148.230.100.21
certbot certificates
```

**Fix**:
```bash
certbot --nginx -d ttshoptool.fun -d www.ttshoptool.fun \
  --email seringuyen0506@gmail.com \
  --agree-tos --non-interactive --redirect
```

---

## 🔄 Redeploy After Changes

```powershell
# 1. Verify changes
.\verify-deploy.ps1

# 2. Deploy
.\deploy.ps1
```

**Or manual update**:
```bash
ssh root@148.230.100.21
cd /var/www/shoptiktok1
git pull origin wip/proxy-debug-2025-10-22
pm2 restart all
```

---

## 📱 Management Commands

### View Logs
```bash
ssh root@148.230.100.21 "pm2 logs"
ssh root@148.230.100.21 "pm2 logs backend"
ssh root@148.230.100.21 "pm2 logs frontend"
```

### Restart Services
```bash
ssh root@148.230.100.21 "pm2 restart all"
ssh root@148.230.100.21 "pm2 restart backend"
ssh root@148.230.100.21 "pm2 restart frontend"
```

### Stop Services
```bash
ssh root@148.230.100.21 "pm2 stop all"
```

### Check Nginx
```bash
ssh root@148.230.100.21 "nginx -t"
ssh root@148.230.100.21 "systemctl status nginx"
```

### View Nginx Logs
```bash
ssh root@148.230.100.21 "tail -f /var/log/nginx/access.log"
ssh root@148.230.100.21 "tail -f /var/log/nginx/error.log"
```

---

## 🎯 Success Criteria

- [ ] `pm2 status` shows both services online
- [ ] `curl https://ttshoptool.fun/api/health` returns 200
- [ ] Website loads at https://ttshoptool.fun
- [ ] Can crawl a product link successfully
- [ ] Results display in table
- [ ] History persists after refresh
- [ ] SSL certificate valid (green padlock)

---

## 📞 VPS Info

- **IP**: 148.230.100.21
- **Domain**: ttshoptool.fun
- **SSH**: `ssh root@148.230.100.21`
- **Project Path**: `/var/www/shoptiktok1`
- **Backend Port**: 8080 (internal)
- **Frontend Port**: 3000 (internal)
- **Public Ports**: 80 (HTTP), 443 (HTTPS)

---

## 🔐 Security Notes

- Backend runs on internal port 8080
- Frontend runs on internal port 3000
- Nginx reverse proxy handles external traffic
- SSL certificate auto-renews via certbot
- CORS configured for production domain
- Environment variables in `.env` file

---

## ⏱️ Deployment Timeline

1. **Pre-verification**: ~1 minute
2. **Git push**: ~10 seconds
3. **VPS connection**: ~5 seconds
4. **Package installation**: ~3-5 minutes
5. **Service startup**: ~10 seconds
6. **SSL setup**: ~30 seconds
7. **Total**: ~5-10 minutes

---

**Last Updated**: 2025-10-24  
**Status**: ✅ READY TO DEPLOY

Run: `.\deploy.ps1`
