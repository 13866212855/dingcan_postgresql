@echo off
chcp 65001 >nul
echo ========================================
echo shetuandabao - Docker 部署脚本
echo ========================================
echo.

echo [1/5] 构建 Docker 镜像...
docker build -t shetuandabao:latest .
if errorlevel 1 (
    echo [错误] Docker 镜像构建失败，部署终止
    pause
    exit /b 1
)
echo 镜像构建成功
echo.

echo [2/5] 停止并移除旧容器...
docker stop shetuandabao 2>nul
docker rm shetuandabao 2>nul
echo 完成
echo.

echo [3/5] 清理旧镜像...
for /f "tokens=*" %%i in ('docker images shetuandabao -q --filter "dangling=true" 2^>nul') do docker rmi %%i 2>nul
echo 完成
echo.

echo [4/5] 启动新容器...
docker run -d ^
  --name shetuandabao ^
  --network mynet ^
  -p 7794:3000 ^
  --restart unless-stopped ^
  -v d:/docker/shetuandabao/data:/app/data ^
  shetuandabao:latest

if errorlevel 1 (
    echo [错误] Docker 容器启动失败
    pause
    exit /b 1
)
echo.

echo [5/5] 检查容器状态...
timeout /t 3 /nobreak >nul
docker ps --filter "name=shetuandabao" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo ========================================
echo 部署成功！
echo ========================================
echo.
echo 访问地址：
echo   资料收集页: http://localhost:7794
echo   管理后台:   http://localhost:7794/admin.html
echo ========================================
echo.

pause
