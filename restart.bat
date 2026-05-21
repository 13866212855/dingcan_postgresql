@echo off
chcp 65001 >nul
echo ========================================
echo   Atmosphere Programming Club System
echo ========================================
echo.
cd /d "%~dp0"

taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [1/2] Checking dependencies...
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo Error: npm install failed
        pause
        exit /b 1
    )
)

echo.
echo [2/2] Starting server...
echo.
echo Frontend: http://localhost:3000
echo Admin:    http://localhost:3000/admin.html
echo.
echo Press Ctrl+C to stop
echo.

node server.js
