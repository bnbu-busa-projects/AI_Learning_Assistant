@echo off
setlocal

cd /d "%~dp0"

set "PROJECT_NAME=ai-learning-assistant"
if "%AILA_BACKEND_URL%"=="" (
  set "BACKEND_URL=http://127.0.0.1:14242"
) else (
  set "BACKEND_URL=%AILA_BACKEND_URL%"
)

echo AI Learning Assistant
echo Checking Docker Desktop...

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop was not found. Install Docker Desktop, then run this launcher again.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop is installed but not running. Attempting to open it...
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  )
  for /L %%I in (1,1,60) do (
    docker info >nul 2>nul
    if not errorlevel 1 goto docker_ready
    timeout /t 2 /nobreak >nul
  )
)

:docker_ready
docker info >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop did not become ready. Start Docker Desktop and run this launcher again.
  exit /b 1
)

if exist "apps\desktop\node_modules\.bin\electron.cmd" (
  echo Starting Electron shell...
  npm --prefix apps/desktop run start
) else (
  echo Electron dependencies are not installed; starting the rebuilt Docker runtime directly.
  docker compose -p "%PROJECT_NAME%" up -d
  if errorlevel 1 exit /b 1
  echo Waiting for backend health...
  call :wait_for_backend
  if errorlevel 1 (
    echo Backend did not become healthy. Recent backend logs:
    docker compose -p "%PROJECT_NAME%" logs --tail=80 backend
    exit /b 1
  )
  echo Workbench: %BACKEND_URL%/ui/
  start "" "%BACKEND_URL%/ui/"
)

endlocal
exit /b 0

:wait_for_backend
for /L %%I in (1,1,180) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%BACKEND_URL%/health'; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { exit 0 } } catch { exit 1 }; exit 1" >nul 2>nul
  if not errorlevel 1 exit /b 0
  timeout /t 2 /nobreak >nul
)
exit /b 1
