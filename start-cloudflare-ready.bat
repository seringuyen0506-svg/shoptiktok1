@echo off
title TikTok Shop Crawler - Server Startup
color 0A

echo.
echo ============================================================
echo    TIKTOK SHOP CRAWLER - CLOUDFLARE TUNNEL READY
echo ============================================================
echo.

REM Kill existing node processes
echo [1/3] Cleaning up old processes...
taskkill /F /IM node.exe 2>nul >nul
timeout /t 2 /nobreak >nul
echo       Done!
echo.

REM Start Backend
echo [2/3] Starting Backend Server (Port 5000)...
start "Backend - Port 5000" cmd /k "cd /d %~dp0backend && node index.js"
timeout /t 4 /nobreak >nul
echo       Backend started!
echo.

REM Start Unified Frontend+Proxy
echo [3/3] Starting Unified Server (Port 3000)...
start "Unified Server - Port 3000" cmd /k "cd /d %~dp0frontend && node unified-server.js"
timeout /t 3 /nobreak >nul
echo       Unified server started!
echo.

echo ============================================================
echo    SERVERS READY!
echo ============================================================
echo.
echo   Local URL:      http://localhost:3000
echo   Health Check:   http://localhost:3000/health
echo   API Health:     http://localhost:3000/api/health
echo.
echo ============================================================
echo    TO USE CLOUDFLARE TUNNEL:
echo ============================================================
echo.
echo   1. Open NEW terminal
echo   2. Run: cloudflared tunnel --url http://localhost:3000
echo   3. Copy the https://xxx.trycloudflare.com URL
echo   4. Test from phone/4G network
echo.
echo ============================================================
echo.
echo Press any key to open browser...
pause >nul

start http://localhost:3000

echo.
echo Browser opened! Server terminals remain running.
echo Close this window to keep servers running.
echo.
pause
