@echo off
setlocal
cd /d "%~dp0"
start "Killjoy Control" powershell.exe -Sta -NoProfile -ExecutionPolicy Bypass -File "%~dp0KilljoyControl.ps1"
exit /b 0
