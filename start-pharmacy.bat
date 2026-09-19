@echo off
title Pharmacy Management System
cd /d "%~dp0"
setlocal EnableDelayedExpansion
set PORT=4050

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
  call npm --prefix backend install
)
if not exist "frontend\node_modules" (
  echo Installing pharmacy screens...
  call npm --prefix frontend install
)

set UI_BUILD=2026-09-20-pos-bill-right
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
echo Opening http://localhost:4050
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:4050"
cd /d "%~dp0backend"
set PORT=4050
npx tsx src/index.ts
pause
