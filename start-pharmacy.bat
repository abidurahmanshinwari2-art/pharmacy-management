@echo off
title Pharmacy Management System
cd /d "%~dp0"
setlocal EnableDelayedExpansion
set PORT=4050

if exist "pharmacy-data\client.json" (
  set "SHOPMODE="
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0read-shop-mode.ps1"
  set /p SHOPMODE=<"%TEMP%\pharmacy-shop-mode.txt"
  if /i "!SHOPMODE!"=="bad" (
    echo The shop PC address is missing. Run join-pharmacy.bat again and type 192.168.0.1
    pause
    exit /b 1
  )
  if /i "!SHOPMODE:~0,6!"=="client" (
    echo This counter PC uses the shop data on !SHOPMODE:~7!
    echo Keep the main shop PC open. Both PCs can sell at the same time.
    start "" "!SHOPMODE:~7!"
    pause
    exit /b 0
  )
  echo This is the main shop PC. Starting the pharmacy here.
  echo The second PC must open http://192.168.0.1:4050
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it first, then run this file again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-desktop-app.ps1"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4050" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%P >nul 2>nul
)

if not exist "backend\node_modules" (
  echo Installing pharmacy server...
  call npm --prefix backend install --no-audit --no-fund
  if errorlevel 1 call npm --prefix backend install --offline --no-audit --no-fund
)
if not exist "frontend\node_modules" (
  echo Installing pharmacy screens...
  call npm --prefix frontend install --no-audit --no-fund
  if errorlevel 1 call npm --prefix frontend install --offline --no-audit --no-fund
)

set UI_BUILD=2026-10-29-lan-firewall
set NEED_BUILD=0
if not exist "frontend\dist\index.html" set NEED_BUILD=1
if not exist "frontend\dist\.ui-build" set NEED_BUILD=1
if exist "frontend\dist\.ui-build" (
  set /p GOT=<frontend\dist\.ui-build
)
if not "!GOT!"=="%UI_BUILD%" set NEED_BUILD=1

if "%NEED_BUILD%"=="1" (
  echo Building pharmacy screens...
  call npm --prefix frontend run build
  if not exist "frontend\dist\index.html" (
    echo.
    echo Pharmacy screens did not build. Close this window, then open Pharmacy Management System again.
    pause
    exit /b 1
  )
  >frontend\dist\.ui-build echo %UI_BUILD%
)

echo.
echo App folder: %~dp0
echo Pharmacy data: %~dp0pharmacy-data
echo This shop PC can work without internet.
echo Opening http://localhost:4050
echo Second PC browser address: http://192.168.0.1:4050
echo In join-pharmacy.bat on the second PC, type 192.168.0.1
echo Do not use an address that starts with 169.254
netsh advfirewall firewall show rule name="Pharmacy Management System" | findstr /I "4050" >nul
if errorlevel 1 (
  echo.
  echo Windows is blocking the second PC. Click Yes on the next question.
  powershell -NoProfile -Command "Start-Process -FilePath '%~dp0allow-second-pc.bat' -Verb RunAs -Wait"
)
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:4050"
cd /d "%~dp0backend"
set PORT=4050
call npm run serve
if errorlevel 1 (
  echo.
  echo Could not start with npm. Trying the local tsx file...
  if exist "node_modules\.bin\tsx.cmd" (
    call node_modules\.bin\tsx.cmd src\index.ts
  ) else (
    echo Node packages are missing. Connect internet once, or copy the folder that already has node_modules.
  )
)
pause
