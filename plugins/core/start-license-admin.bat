@echo off
setlocal
cd /d "%~dp0"
set MSRB_LICENSE_ADMIN_OPEN=1
node license-admin-server.js
pause
