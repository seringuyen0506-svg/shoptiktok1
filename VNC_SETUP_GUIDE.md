# VNC Connection Guide

## ✅ VNC Server đã chạy trên VPS!

### 📋 Thông tin kết nối:
- **VPS IP**: 148.230.100.21
- **VNC Port**: 5901 (localhost only)
- **Display**: :99 (1920x1080)
- **Password**: Không có (nopw)

---

## 🔗 Bước 1: Tạo SSH Tunnel (Port Forwarding)

### Trên Windows PowerShell:
```powershell
ssh -L 5901:localhost:5901 root@148.230.100.21
```

**Giữ cửa sổ này mở!** Đừng đóng terminal.

---

## 📺 Bước 2: Kết nối VNC Viewer

### Download VNC Viewer (miễn phí):
- **RealVNC Viewer**: https://www.realvnc.com/en/connect/download/viewer/
- **TightVNC Viewer**: https://www.tightvnc.com/download.php
- **UltraVNC**: https://uvnc.com/downloads/ultravnc.html

### Kết nối:
1. Mở VNC Viewer
2. Nhập địa chỉ: `localhost:5901`
3. Click "Connect"
4. Không cần password (bấm OK nếu hỏi)

---

## 🎯 Bước 3: Test Browser

1. Vào website: https://ttshoptool.fun
2. Click nút **"🌐 Mở Browser"**
3. Xem trong VNC Viewer → Browser sẽ xuất hiện!

---

## 🔧 Commands hữu ích:

### Stop VNC Server:
```bash
ssh root@148.230.100.21 "killall x11vnc"
```

### Restart VNC Server:
```bash
ssh root@148.230.100.21 "x11vnc -display :99 -bg -nopw -listen localhost -xkb"
```

### Check xvfb status:
```bash
ssh root@148.230.100.21 "systemctl status xvfb"
```

---

## 🎉 Giờ bạn có thể:
✅ Xem browser real-time khi crawl
✅ Login TikTok thủ công
✅ Cài Chrome extensions
✅ Debug trực quan

**Lưu ý**: VNC chỉ hiển thị, bạn vẫn điều khiển qua web UI!
