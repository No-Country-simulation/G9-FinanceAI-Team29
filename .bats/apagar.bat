@echo off
setlocal
title FinSightAI - Apagar entorno local
cd /d "%~dp0"

echo ================================================
echo    FinSightAI  -  Apagando contenedores
echo ================================================
echo.

docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo [OK] Docker no esta corriendo. No hay nada que apagar.
  echo.
  pause
  exit /b 0
)

echo [..] Deteniendo contenedores (docker compose stop)...
docker compose stop

echo.
echo [OK] Contenedores detenidos. Los datos (Postgres/MinIO) se conservan.
echo      Para volver a levantar usa "levantar.bat".
echo.
pause
exit /b 0
