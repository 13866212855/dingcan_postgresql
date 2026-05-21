@echo off
chcp 65001 >nul
setlocal EnableExtensions

echo ========================================
echo   Deploy shetuandabao to remote server
echo ========================================
echo.

REM ====== Configuration ======
set "IMAGE_NAME=shetuandabao"
set "CONTAINER_NAME=shetuandabao"
set "CONTAINER_PORT=7794"
set "INTERNAL_PORT=3000"
set "REMOTE_DATA_DIR=/bak/docker/shetuandabao/data"
set "VOLUME_MOUNT=-v /bak/docker/shetuandabao/data:/app/data"
set "ENV_PARAMS="
set "LOCAL_TEST_ENV_PARAMS="
set "LOCAL_TEST_VOLUME_PARAMS="
set "NETWORK_PARAM=--network mynet"
set "EXTRA_RUN_ARGS="

set "TAR_DIR=d:\temp\tar"
set "TAR_FILE=%TAR_DIR%\%IMAGE_NAME%.tar"

set "REMOTE_USER=gpzx"
set "REMOTE_HOST=172.29.173.42"
set "REMOTE_TAR_DIR=/bak/tar"

echo [Step 1/10] Check local temp directory...
if not exist "%TAR_DIR%" (
    mkdir "%TAR_DIR%"
    if errorlevel 1 (
        echo ERROR: Could not create %TAR_DIR%.
        pause
        exit /b 1
    )
)
echo OK: %TAR_DIR%
echo.

echo [Step 2/10] Build Docker image...
docker build --progress=plain -t %IMAGE_NAME%:latest .
if errorlevel 1 (
    echo ERROR: Docker image build failed.
    pause
    exit /b 1
)
echo Docker image build succeeded.
echo.

echo [Step 3/10] Prove the local image can start...
docker rm -f %CONTAINER_NAME%_local_test 2>nul
docker run -d --name %CONTAINER_NAME%_local_test -p 127.0.0.1:7799:%INTERNAL_PORT% %LOCAL_TEST_ENV_PARAMS% %LOCAL_TEST_VOLUME_PARAMS% %IMAGE_NAME%:latest
if errorlevel 1 (
    echo ERROR: Local test container failed to start.
    pause
    exit /b 1
)
timeout /t 8 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:7799/' -TimeoutSec 8; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    echo ERROR: Local HTTP test failed. Recent local logs:
    docker logs --tail 120 %CONTAINER_NAME%_local_test
    docker rm -f %CONTAINER_NAME%_local_test 2>nul
    pause
    exit /b 1
)
docker logs --tail 40 %CONTAINER_NAME%_local_test
docker rm -f %CONTAINER_NAME%_local_test 2>nul
echo Local image proof passed.
echo.

echo [Step 4/10] Save image to tar file...
docker save -o "%TAR_FILE%" %IMAGE_NAME%:latest
if errorlevel 1 (
    echo ERROR: Docker image save failed.
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Item '%TAR_FILE%' | Select-Object FullName, Length, LastWriteTime"
echo.

echo [Step 5/10] Upload image to remote server...
ssh %REMOTE_USER%@%REMOTE_HOST% "mkdir -p %REMOTE_TAR_DIR%"
if errorlevel 1 (
    echo ERROR: Could not create or access remote tar directory.
    pause
    exit /b 1
)
scp "%TAR_FILE%" %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_TAR_DIR%/
if errorlevel 1 (
    echo ERROR: Upload failed.
    pause
    exit /b 1
)
echo Upload succeeded.
echo.

echo [Step 6/10] Load image on remote server...
ssh %REMOTE_USER%@%REMOTE_HOST% "docker load -i %REMOTE_TAR_DIR%/%IMAGE_NAME%.tar && docker images %IMAGE_NAME%"
if errorlevel 1 (
    echo ERROR: Remote docker load failed.
    pause
    exit /b 1
)
echo.

echo [Step 7/10] Verify remote image content...
ssh %REMOTE_USER%@%REMOTE_HOST% "docker inspect %IMAGE_NAME%:latest --format '{{index .Config.Labels \"description\"}}' | grep -q '社团资料收集系统' && echo 'Image label OK' || echo 'WARNING: Image label not found'"
if errorlevel 1 (
    echo ERROR: Remote image proof failed. The loaded image may not contain the expected build.
    pause
    exit /b 1
)
echo Remote image proof passed.
echo.

echo [Step 8/10] Prepare and validate remote bind mounts...
ssh %REMOTE_USER%@%REMOTE_HOST% "set -e; sudo mkdir -p /bak/docker/shetuandabao/data; if [ -d /bak/docker/shetuandabao/data/config.json ]; then echo 'ERROR: config.json is a directory, removing'; sudo rm -rf /bak/docker/shetuandabao/data/config.json; fi; docker run --user root --rm -v /bak/docker/shetuandabao/data:/tmp/outdata %IMAGE_NAME%:latest sh -c 'if [ ! -f /tmp/outdata/config.json ]; then cp /app/data/config.json /tmp/outdata/ 2>/dev/null || echo \"No config.json in image to seed\"; else echo \"config.json already exists\"; fi && chown -R 1000:1000 /tmp/outdata'; sudo chown -R 1000:1000 /bak/docker/shetuandabao/data"
if errorlevel 1 (
    echo ERROR: Remote mount preparation failed.
    echo Tip: check whether a database file path, such as config.json, was accidentally created as a directory.
    pause
    exit /b 1
)
echo Remote mount preparation passed.
echo.

echo [Step 9/10] Run disposable remote mounted test...
ssh %REMOTE_USER%@%REMOTE_HOST% "docker run --rm -v /bak/docker/shetuandabao/data:/app/data %IMAGE_NAME%:latest sh -c 'test -d /app/data && ls -la /app/data && echo \"Data directory OK\" || echo \"ERROR: Data directory not accessible\"'"
if errorlevel 1 (
    echo ERROR: Disposable mounted test failed. Do not start the final container until this passes.
    pause
    exit /b 1
)
echo Disposable mounted test passed.
echo.

echo [Step 10/10] Stop old container and start new container...
ssh %REMOTE_USER%@%REMOTE_HOST% "docker stop %CONTAINER_NAME% 2>/dev/null || true; docker rm %CONTAINER_NAME% 2>/dev/null || true; docker run -d --name %CONTAINER_NAME% -p 0.0.0.0:%CONTAINER_PORT%:%INTERNAL_PORT% %VOLUME_MOUNT% %ENV_PARAMS% %NETWORK_PARAM% %EXTRA_RUN_ARGS% --restart unless-stopped %IMAGE_NAME%:latest"
if errorlevel 1 (
    echo ERROR: Failed to start remote container.
    pause
    exit /b 1
)
echo Container started.
echo.

echo [Verify] Wait 8 seconds and check remote container status...
timeout /t 8 /nobreak >nul
ssh %REMOTE_USER%@%REMOTE_HOST% "docker ps -a --filter name=^/%CONTAINER_NAME%$"
if errorlevel 1 (
    echo ERROR: Could not read remote container status.
    pause
    exit /b 1
)
echo.

echo [Verify] Wait for remote HTTP service to become ready...
ssh %REMOTE_USER%@%REMOTE_HOST% "i=1; while [ $i -le 30 ]; do if command -v curl >/dev/null 2>&1; then curl -fsS http://127.0.0.1:%CONTAINER_PORT%/ >/dev/null && exit 0; else wget -q --spider http://127.0.0.1:%CONTAINER_PORT%/ >/dev/null && exit 0; fi; sleep 2; i=$((i+1)); done; exit 1"
if errorlevel 1 (
    echo ERROR: Remote HTTP did not become ready at http://127.0.0.1:%CONTAINER_PORT%/
    echo.
    echo Remote container status:
    ssh %REMOTE_USER%@%REMOTE_HOST% "docker ps -a --filter name=^/%CONTAINER_NAME%$"
    echo.
    echo Recent remote container logs:
    ssh %REMOTE_USER%@%REMOTE_HOST% "docker logs --tail 120 %CONTAINER_NAME%"
    pause
    exit /b 1
)
echo Remote localhost HTTP check passed.
echo.

echo [Verify] Try accessing the remote service from this PC...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://%REMOTE_HOST%:%CONTAINER_PORT%/' -TimeoutSec 8; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    echo WARNING: This PC cannot access http://%REMOTE_HOST%:%CONTAINER_PORT%/.
    echo Remote-localhost passed, so check firewall, security group, or network policy.
) else (
    echo This PC can access the remote service.
)
echo.

echo ========================================
echo   Deployment finished
echo ========================================
echo Image      : %IMAGE_NAME%:latest
echo Container  : %CONTAINER_NAME%
echo URL        : http://%REMOTE_HOST%:%CONTAINER_PORT%
echo Remote data: /bak/docker/shetuandabao/data
echo.
echo Useful remote commands:
echo   ssh %REMOTE_USER%@%REMOTE_HOST%
echo   docker logs %CONTAINER_NAME%
echo   docker ps -a
echo   docker exec -it %CONTAINER_NAME% /bin/sh
echo.
pause
