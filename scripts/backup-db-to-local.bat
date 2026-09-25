@echo off
title Cliptica Database Backup
powershell.exe -ExecutionPolicy Bypass -File "%~dp0backup-db-to-local.ps1"
echo.
pause
