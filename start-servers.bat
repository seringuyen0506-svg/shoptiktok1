@echo off
echo Killing all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting Backend...
start "Backend Server" cmd /k "cd /d %~dp0backend && node index.js"
timeout /t 3 /nobreak >nul

echo Starting Frontend...
start "Frontend Server" cmd /k "cd /d %~dp0frontend && node server.js"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo ✅ Both servers started!
echo ========================================
echo.
echo 🌐 URL: http://localhost:3000
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul
