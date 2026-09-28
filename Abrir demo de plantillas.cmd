@echo off
cd /d "%~dp0"
node scripts\abrir-demo-plantillas.mjs
if errorlevel 1 pause
