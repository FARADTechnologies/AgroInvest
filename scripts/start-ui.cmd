@echo off
rem Starts the web UI on http://localhost:3000 and opens the browser. No Docker needed.
rem
rem   start-ui.cmd        UI against the deployed API (newest backend, online data)
rem   start-ui.cmd mock   UI against the offline mock API on :8000 (no internet needed)
rem
rem A .cmd file runs even where PowerShell blocks npm.ps1 / scripts.

setlocal
cd /d "%~dp0..\web"

if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm.cmd install || goto :error
)

if /i "%~1"=="mock" (
  start "Agro mock API (:8000)" cmd /k "node mock-api\server.mjs"
  start "Agro web UI (:3000)" cmd /k "npm.cmd run dev"
) else (
  start "Agro web UI (:3000, live API)" cmd /k "npm.cmd run dev:live"
)

echo Waiting for http://localhost:3000 ...
:wait
rem ping waits about 2 s and, unlike timeout.exe, also works without a console.
ping -n 3 127.0.0.1 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:3000/login -TimeoutSec 5) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto :wait

start "" http://localhost:3000
echo Portal is running. Close the server window(s) to stop it.
exit /b 0

:error
echo Failed to install dependencies.
exit /b 1
