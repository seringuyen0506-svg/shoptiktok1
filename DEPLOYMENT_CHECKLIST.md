# ✅ DEPLOYMENT CHECKLIST - TikTok Shop Crawler

## 🔍 Vấn Đề Đã Phát Hiện và Fix

### ❌ Vấn đề chính: CORS Error
**Triệu chứng**: Frontend không kết nối được backend, lỗi "Not allowed by CORS"

**Nguyên nhân**:
1. Backend không có `dotenv` package để load `.env` file
2. File `.env` không được tạo trên VPS
3. `ALLOW_ORIGINS` environment variable không được set

**Giải pháp đã áp dụng**:
- ✅ Thêm `import dotenv from 'dotenv'` vào `backend/index.js`
- ✅ Thêm `dotenv.config()` để load environment variables
- ✅ Thêm `dotenv` vào `package.json` dependencies
- ✅ Update deployment script tạo `.env` với CORS config đúng
- ✅ Fix numbering trong deployment steps (11 steps thay vì 10)

## 📋 Pre-Deployment Checklist

### Local Testing
- [ ] Backend chạy được local: `cd backend && npm start`
- [ ] Frontend chạy được local: `cd frontend && npm start`
- [ ] Test API endpoint: `curl http://localhost:5000/api/health`
- [ ] Test frontend: `curl http://localhost:3000`
- [ ] Code đã commit: `git status` (should be clean)

### VPS Requirements
- [ ] SSH access: `ssh root@148.230.100.21` works
- [ ] Domain DNS configured: A record @ → 148.230.100.21
- [ ] Domain DNS configured: A record www → 148.230.100.21
- [ ] VPS có port 80, 443 available (no Docker/Apache blocking)

## 🚀 Deployment Steps

### 1. Deploy Command
```powershell
.\deploy.ps1
```

### 2. Nhập password VPS 2 lần:
- Lần 1: Upload deployment script
- Lần 2: Execute deployment

### 3. Script tự động thực hiện:
```
[1/11] Stopping conflicting services
[2/11] Installing Node.js 20.x
[3/11] Installing PM2
[4/11] Installing Nginx + Certbot
[5/11] Clone/Update repository
[6/11] Installing backend dependencies (+ dotenv)
[7/11] Installing frontend dependencies
[8/11] Creating .env configuration ⭐ QUAN TRỌNG
[9/11] Starting PM2 services
[10/11] Configuring Nginx
[11/11] Setting up SSL certificate
```

## 🔧 Post-Deployment Verification

### Bước 1: Kiểm tra services
```powershell
ssh root@148.230.100.21 "pm2 status"
```

**Expected output**:
```
┌────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────────┐
│ id │ name        │ mode    │ pid     │ uptime   │ status │ cpu mem  │
├────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────────┤
│ 0  │ backend     │ fork    │ xxxxx   │ Xm       │ online │ 0%  80mb │
│ 1  │ frontend    │ fork    │ xxxxx   │ Xm       │ online │ 0%  60mb │
└────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────────┘
```

### Bước 2: Kiểm tra .env file
```powershell
ssh root@148.230.100.21 "cat /var/www/shoptiktok1/.env"
```

**Expected output**:
```
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun,https://www.ttshoptool.fun,http://www.ttshoptool.fun
NODE_ENV=production
```

### Bước 3: Kiểm tra ports
```powershell
ssh root@148.230.100.21 "netstat -tlnp | grep -E ':(3000|5000)'"
```

**Expected output**:
```
tcp6  0  0 :::5000  :::*  LISTEN  xxxxx/node  (backend)
tcp6  0  0 :::3000  :::*  LISTEN  xxxxx/node  (frontend)
```

### Bước 4: Test backend health
```powershell
curl https://ttshoptool.fun/api/health
```

**Expected output**:
```json
{"status":"ok","timestamp":"...","service":"TikTok Shop Crawler API"}
```

### Bước 5: Test CORS
```powershell
curl -H "Origin: https://ttshoptool.fun" -I https://ttshoptool.fun/api/health
```

**Expected headers**:
```
Access-Control-Allow-Origin: https://ttshoptool.fun
Access-Control-Allow-Credentials: true
```

### Bước 6: Test website
```
https://ttshoptool.fun
```

**Expected**:
- ✅ Website loads
- ✅ Không có CORS error trong console
- ✅ Test proxy button hoạt động
- ✅ API connection status: Connected

## 🐛 Troubleshooting

### Backend CORS Error
```powershell
# Check logs
ssh root@148.230.100.21 "pm2 logs backend --lines 50"

# Should NOT see: "Error: Not allowed by CORS"
# Should see: Backend running on port 5000
```

**Fix nếu vẫn lỗi CORS**:
```powershell
ssh root@148.230.100.21
cd /var/www/shoptiktok1
cat > .env << 'EOF'
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun,https://www.ttshoptool.fun,http://www.ttshoptool.fun
NODE_ENV=production
EOF
pm2 restart backend
```

### Backend chạy sai port (8080 thay vì 5000)
```powershell
ssh root@148.230.100.21 "pm2 delete backend && cd /var/www/shoptiktok1/backend && PORT=5000 pm2 start index.js --name backend --update-env && pm2 save"
```

### Port bị chiếm
```powershell
ssh root@148.230.100.21 "lsof -i :5000"
# Kill process nếu cần:
ssh root@148.230.100.21 "kill -9 <PID>"
```

### Nginx không start
```powershell
# Check what's using port 80
ssh root@148.230.100.21 "lsof -i :80"

# Stop Docker if running
ssh root@148.230.100.21 "docker stop \$(docker ps -q)"

# Restart Nginx
ssh root@148.230.100.21 "systemctl restart nginx"
```

### SSL Certificate Error
```powershell
ssh root@148.230.100.21 "certbot certificates"
ssh root@148.230.100.21 "certbot renew --dry-run"
```

## 📊 Monitoring Commands

### Real-time logs
```powershell
ssh root@148.230.100.21 "pm2 logs"
```

### Specific service logs
```powershell
ssh root@148.230.100.21 "pm2 logs backend"
ssh root@148.230.100.21 "pm2 logs frontend"
```

### Resource monitoring
```powershell
ssh root@148.230.100.21 "pm2 monit"
```

### Restart services
```powershell
ssh root@148.230.100.21 "pm2 restart all"
```

### Stop services
```powershell
ssh root@148.230.100.21 "pm2 stop all"
```

## 🔄 Update Workflow

Mỗi khi sửa code:

1. **Local**: Test changes locally
2. **Commit**: `git add . && git commit -m "message"`
3. **Deploy**: `.\deploy.ps1`
4. **Verify**: Check https://ttshoptool.fun

## ✅ Success Criteria

Deployment thành công khi:

- ✅ `pm2 status` shows both services **online**
- ✅ `.env` file exists với CORS config đúng
- ✅ Backend listening on port **5000**
- ✅ Frontend listening on port **3000**
- ✅ `/api/health` returns **200 OK**
- ✅ No CORS errors in browser console
- ✅ Website **https://ttshoptool.fun** loads correctly
- ✅ Proxy test button works
- ✅ SSL certificate valid (green lock)

## 📝 Changes Made

### Files Modified:
1. `backend/index.js`
   - Added `import dotenv from 'dotenv'`
   - Added `dotenv.config()`

2. `backend/package.json`
   - Added `"dotenv": "^16.4.5"` to dependencies

3. `deploy.ps1`
   - Added step 8: Create `.env` file
   - Updated step numbering (11 steps total)
   - `.env` includes all domain variants for CORS

### Environment Variables Required:
```
ALLOW_ORIGINS=https://ttshoptool.fun,http://ttshoptool.fun,https://www.ttshoptool.fun,http://www.ttshoptool.fun
NODE_ENV=production
```

## 🎯 Final Notes

- **CORS config** is critical - without it, frontend cannot call backend
- **dotenv** must be installed and loaded before Express starts
- **PORT=5000** must be set for backend (frontend proxies to this port)
- **`.env` file** must be in `/var/www/shoptiktok1/` root directory
- **PM2** must be restarted after `.env` changes

---

**Last Updated**: 2025-10-22  
**Status**: Ready for deployment  
**Deployment Command**: `.\deploy.ps1`
