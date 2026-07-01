@echo off
chcp 65001 >nul
title AfroMercado - Lanzador
echo ============================================
echo   Iniciando AfroMercado
echo   Backend (API):  http://localhost:3001
echo   Web (tienda):   http://localhost:3002
echo ============================================
echo.

echo Deteniendo procesos anteriores...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 3 /nobreak >nul

echo Regenerando cliente Prisma...
cd /d D:\AfroMercado\afromercado
call npm run build
cd /d D:\AfroMercado

echo Iniciando backend...
start "AfroMercado API" cmd /k "cd /d D:\AfroMercado\afromercado && npm run dev"
timeout /t 5 /nobreak >nul

echo Iniciando frontend...
start "AfroMercado Web" cmd /k "cd /d D:\AfroMercado\afromercado-web && npm run dev"
timeout /t 12 /nobreak >nul

start http://localhost:3002

echo.
echo Listo. Dos ventanas abiertas (API y Web).
echo Para apagar, cierra esas ventanas.
echo.
pause
