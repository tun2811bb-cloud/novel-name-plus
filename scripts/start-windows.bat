@echo off
cd /d "%~dp0.."
if not exist "node_modules\electron" (
  echo Chua cai dat. Hay chay PowerShell: .\scripts\setup-windows.ps1
  pause
  exit /b 1
)
call npm start
if errorlevel 1 pause
