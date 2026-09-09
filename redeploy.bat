@echo off
echo ========================================
echo dingcan_postgresql_tenant - Docker Deployment Script (Windows)
echo ========================================
echo.

:: 配置参数
set "IMAGE_NAME=dingcan_postgresql_tenant"
set "CONTAINER_NAME=dingcan_postgresql_tenant"
set "HOST_PORT=7846"
set "INTERNAL_PORT=3000"
set "DATA_DIR=D:\docker\%CONTAINER_NAME%\data"

echo [1/4] Building Docker image %IMAGE_NAME%:latest...
docker build -t %IMAGE_NAME%:latest .
if errorlevel 1 (
    echo [ERROR] Docker build failed. Deployment aborted.
    pause
    exit /b 1
)
echo Build successful.
echo.

echo [2/4] Stopping and removing old container...
docker stop %CONTAINER_NAME% 2>nul
docker rm %CONTAINER_NAME% 2>nul
echo Done.
echo.

echo [3/4] Cleaning up dangling images...
for /f "tokens=*" %%i in ('docker images %IMAGE_NAME% -q --filter "dangling=true" 2^>nul') do docker rmi %%i 2>nul
echo Done.
echo.

echo [4/4] Starting new container...
if not exist "%DATA_DIR%" ( mkdir "%DATA_DIR%" )

:: 启动容器
docker run -d --name %CONTAINER_NAME% -p %HOST_PORT%:%INTERNAL_PORT% -v "%DATA_DIR%:/app/data" --restart unless-stopped %IMAGE_NAME%:latest

if errorlevel 1 (
    echo [ERROR] Failed to start Docker container.
    pause
    exit /b 1
)
echo.

echo [验证] 等待 3 秒后检查容器运行状态...
timeout /t 3 /nobreak >nul
docker ps | findstr %CONTAINER_NAME%
echo.

echo ========================================
echo Deployment Successful!
echo ========================================
echo Access URL: http://localhost:%HOST_PORT%
echo ========================================
echo.
pause
