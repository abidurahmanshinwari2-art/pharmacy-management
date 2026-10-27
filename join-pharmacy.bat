@echo off
title Join Pharmacy Shop PC
cd /d "%~dp0"
echo.
echo Use this on the SECOND computer of the same pharmacy.
echo The MAIN shop PC must stay open with start-pharmacy.bat.
echo Both computers then sell from the same stock and bills.
echo.
echo On the main PC, Settings shows the shop address, like 192.168.1.20
echo.
set /p HOST=Write the main shop PC address: 
if "%HOST%"=="" (
  echo No address was written.
  pause
  exit /b 1
)
if not exist "pharmacy-data" mkdir "pharmacy-data"
powershell -NoProfile -Command ^
  "$h='%HOST%'.Trim(); $h=$h -replace '^https?://',''; $h=$h -replace '/.*$',''; $h=$h -replace ':\d+$',''; @{host=$h; port=4050} | ConvertTo-Json | Set-Content -Encoding utf8 '%~dp0pharmacy-data\client.json'"
echo.
echo Saved. This PC is now a counter for that shop.
echo Next time, open Pharmacy Management System. It will use the shared shop data.
echo Login with cashier, manager, or admin on this PC.
echo.
pause
