@echo off
chcp 65001 >nul
title AfroMercado - Migraciones
echo ============================================
echo   AfroMercado — Migraciones de base de datos
echo ============================================
echo.

cd /d D:\AfroMercado\afromercado

echo [1/2] Aplicando migraciones pendientes...
echo.
call npx prisma migrate deploy
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERROR: Fallo al aplicar las migraciones.
  echo Revisa la conexion a PostgreSQL y el archivo .env
  pause
  exit /b 1
)

echo.
echo [2/2] Regenerando cliente Prisma...
echo.
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo AVISO: npx prisma generate tuvo un error ^(probablemente el DLL esta
  echo bloqueado por nodemon^). El cliente JS si fue actualizado.
  echo Reinicia el servidor backend para que tome los cambios.
) else (
  echo Cliente Prisma actualizado correctamente.
)

echo.
echo ============================================
echo   Listo. Migraciones aplicadas.
echo   Si el servidor esta corriendo, reinicialo
echo   para que tome los nuevos modelos.
echo ============================================
echo.
pause
