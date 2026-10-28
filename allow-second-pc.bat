@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-shop-firewall.ps1"
exit /b %ERRORLEVEL%
