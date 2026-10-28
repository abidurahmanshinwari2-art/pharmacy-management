@echo off
title Make Pharmacy License Key
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js first, then run this file again.
  pause
  exit /b 1
)
if not exist "backend\src\lib\makeLicense.js" (
  echo The license maker file is missing.
  echo Copy the full pharmacy folder again, then run this file.
  pause
  exit /b 1
)
node backend\src\lib\makeLicense.js %*
set EXITCODE=%ERRORLEVEL%
echo.
if not "%EXITCODE%"=="0" echo The license key was not made. Read the message above.
pause
exit /b %EXITCODE%
