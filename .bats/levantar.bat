@echo off
setlocal
title FinSightAI - Levantar entorno local
REM Se para en la carpeta del repo (donde esta este .bat), sin importar donde se clono.
cd /d "%~dp0"

echo ================================================
echo    FinSightAI  -  Levantando entorno local
echo ================================================
echo.

REM --- 1) Esta corriendo el motor de Docker? ---
docker info >nul 2>&1
if %errorlevel%==0 goto dockerok

echo [..] Docker no responde. Abriendo Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo [..] Esperando a que arranque el motor ^(puede tardar 1-2 minutos^)...
set /a intentos=0

:waitdocker
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if %errorlevel%==0 goto dockerok
set /a intentos+=1
if %intentos% geq 60 goto dockerfail
goto waitdocker

:dockerfail
echo.
echo [ERROR] Docker no arranco tras 3 minutos.
echo         Abri Docker Desktop a mano, espera que quede "Running" y reintenta.
echo.
pause
exit /b 1

:dockerok
echo [OK] Motor de Docker listo.
echo.

REM --- 2) Chequeo minimo de .env ---
if not exist "Backend\backend\.env" echo [AVISO] Falta Backend\backend\.env  (pedilo a tu lider)
if not exist "AI-Service\.env"      echo [AVISO] Falta AI-Service\.env       (pedilo a tu lider)
echo.

REM --- 3) Levantar los contenedores ---
echo [..] Levantando contenedores (docker compose up -d --build)...
docker compose up -d --build
if %errorlevel% neq 0 goto composefail

echo.
echo [..] Esperando a que el backend termine de arrancar...
timeout /t 12 /nobreak >nul

echo.
echo ================================================
echo    Estado de los contenedores:
echo ================================================
docker compose ps
echo.

echo [OK] Listo. Abriendo la app en el navegador...
start "" "http://localhost"

echo.
echo    App:        http://localhost
echo    MinIO web:  http://localhost:9001   (user/pass: minioadmin)
echo    Apagar:     apagar.bat
echo.
pause
exit /b 0

:composefail
echo.
echo [ERROR] Fallo "docker compose up". Revisa el mensaje de arriba.
echo         Causa comun: faltan los archivos .env (pedilos a tu lider).
echo.
pause
exit /b 1
