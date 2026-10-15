@echo off
rem Starts the web UI with the mock API (no Docker needed): two windows,
rem mock API on :8000 and Next.js on :3000, then opens the browser.
rem A .cmd file runs even where PowerShell blocks npm.ps1 / scripts.

setlocal
cd /d "%~dp0..\web"

if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm.cmd install || goto :error
)

start "Agro mock API (:8000)" cmd /k "node mock-api\server.mjs"
start "Agro web UI (:3000)" cmd /k "npm.cmd run dev"

echo Waiting for http://localhost:3000 ...
:wait
rem ping waits about 2 s and, unlike timeout.exe, also works without a console.
ping -n 3 127.0.0.1 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:3000/login -TimeoutSec 5) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto :wait

start "" http://localhost:3000
echo Portal is running. Close the two server windows to stop it.
exit /b 0

:error
echo Failed to install dependencies.
exit /b 1
