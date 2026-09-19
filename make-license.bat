@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  pause
  exit /b 1
)
npx --prefix backend tsx backend\src\lib\makeLicense.ts %*
echo.
pause
