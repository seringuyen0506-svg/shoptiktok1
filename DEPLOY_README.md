# 🚀 One-Command Deployment

Deploy toàn bộ Frontend + Backend + SSL lên VPS Hostinger chỉ với **1 lệnh duy nhất**.

## Yêu cầu

- ✅ Git đã cấu hình
- ✅ SSH access đến VPS
- ✅ PowerShell (Windows)

## Deployment - Chỉ 1 Lệnh!

```powershell
.\deploy.ps1
```

**Chỉ cần nhập password VPS 2 lần**, script sẽ tự động:

### ✨ Tự động thực hiện:

1. 📤 **Push code lên GitHub**
   - Commit tất cả thay đổi
   - Push lên branch `wip/proxy-debug-2025-10-22`

2. 🛠️ **Cài đặt môi trường VPS**
   - Node.js 20.x
   - PM2 Process Manager
   - Nginx Web Server
   - Certbot (Let's Encrypt SSL)

3. 📦 **Deploy ứng dụng**
   - Clone/update repository từ GitHub
   - Install dependencies (Backend + Frontend)
   - Start Backend (port 5000) với PM2
   - Start Frontend (port 3000) với PM2
   - Auto-restart on boot

4. 🌐 **Cấu hình Nginx**
   - Reverse proxy từ port 80/443 → 3000
   - Health check endpoint

5. 🔐 **Setup SSL Certificate**
   - Tự động cài SSL từ Let's Encrypt
   - Auto-redirect HTTP → HTTPS
   - Auto-renewal enabled

## Thông tin VPS

- **IP**: 148.230.100.21
- **Domain**: ttshoptool.fun
- **Email**: seringuyen0506@gmail.com

## Sau khi deploy

### Website live tại:
- 🌐 https://ttshoptool.fun
- 🌐 https://www.ttshoptool.fun

### Quản lý services:

```powershell
# Xem trạng thái
ssh root@148.230.100.21 'pm2 status'

# Xem logs
ssh root@148.230.100.21 'pm2 logs'

# Restart services
ssh root@148.230.100.21 'pm2 restart all'

# Stop services
ssh root@148.230.100.21 'pm2 stop all'
```

## Update code

Mỗi khi có thay đổi code, chỉ cần chạy lại:

```powershell
.\deploy.ps1
```

Script sẽ tự động:
- ✅ Push code mới lên GitHub
- ✅ Pull code trên VPS
- ✅ Install dependencies mới (nếu có)
- ✅ Restart services với code mới

## Cấu trúc Deployment

```
Local (Windows)
    │
    ├─ git push → GitHub
    │
    └─ .\deploy.ps1
         │
         ├─ SSH vào VPS
         │    │
         │    ├─ git clone/pull
         │    ├─ npm install
         │    ├─ PM2 start
         │    ├─ Nginx config
         │    └─ SSL setup
         │
         └─ Website Live! 🎉
```

## Troubleshooting

### Port đã bị chiếm
```bash
ssh root@148.230.100.21 "lsof -i :5000"
ssh root@148.230.100.21 "kill -9 <PID>"
```

### Backend không start
```bash
ssh root@148.230.100.21 "pm2 logs backend --lines 50"
```

### SSL certificate lỗi
```bash
ssh root@148.230.100.21 "certbot renew --dry-run"
```

## Features

- ✅ **One-command deployment** - Chỉ 1 lệnh deploy tất cả
- ✅ **Auto HTTPS** - Tự động setup SSL
- ✅ **Auto-restart** - PM2 tự động restart khi crash
- ✅ **Auto-boot** - Tự động start khi VPS reboot
- ✅ **Zero downtime** - Restart không làm gián đoạn service
- ✅ **Health monitoring** - PM2 monitor CPU, memory
- ✅ **Log management** - Logs tập trung qua PM2

## Tech Stack

### Frontend (Port 3000)
- Express.js unified server
- Static file serving
- API proxy to backend

### Backend (Port 5000)
- TikTok Shop Crawler API
- hmcaptcha.com integration
- Proxy support

### Infrastructure
- **Web Server**: Nginx 1.24
- **Process Manager**: PM2
- **SSL**: Let's Encrypt
- **OS**: Ubuntu 24.04 LTS
- **Node.js**: 20.x

## Security

- ✅ HTTPS enabled (SSL certificate)
- ✅ Auto-redirect HTTP → HTTPS
- ✅ Security headers configured
- ✅ PM2 runs as root (VPS environment)

## Performance

- ⚡ Nginx reverse proxy caching
- ⚡ PM2 cluster mode ready
- ⚡ Static file serving optimized
- ⚡ Health check endpoint

## Support

**Lỗi deployment?**
```bash
# Check PM2 logs
ssh root@148.230.100.21 'pm2 logs --lines 100'

# Check Nginx logs
ssh root@148.230.100.21 'tail -f /var/log/nginx/error.log'

# Restart everything
ssh root@148.230.100.21 'pm2 restart all && systemctl restart nginx'
```

---

**Deployment Date**: 2025-10-22  
**Status**: ✅ Production Ready  
**Uptime**: Monitored by PM2
