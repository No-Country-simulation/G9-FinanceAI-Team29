@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo        FinSightAI - Inicio local
echo ==========================================
echo.

set "MISSING=0"

if not defined JAVA_HOME if exist "C:\Program Files\Java\jdk-21.0.11\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Java\jdk-21.0.11"
  set "PATH=C:\Program Files\Java\jdk-21.0.11\bin;%PATH%"
)

if not defined MAVEN_HOME if exist "C:\Users\fp\Downloads\apache-maven-3.9.16-bin\apache-maven-3.9.16\bin\mvn.cmd" (
  set "MAVEN_HOME=C:\Users\fp\Downloads\apache-maven-3.9.16-bin\apache-maven-3.9.16"
  set "PATH=C:\Users\fp\Downloads\apache-maven-3.9.16-bin\apache-maven-3.9.16\bin;%PATH%"
)

if not exist "frontend\node_modules" (
  echo [ERROR] Faltan dependencias del frontend.
  echo         Ejecuta: cd frontend ^&^& npm install
  set "MISSING=1"
)

where java >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Java 21.
  set "MISSING=1"
)

where mvn >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Maven.
  set "MISSING=1"
)

if not exist "AI-Service\.venv\Scripts\python.exe" (
  echo [ERROR] No existe AI-Service\.venv.
  echo         Instala Python 3.12 y ejecuta:
  echo         py -3.12 -m venv AI-Service\.venv
  echo         AI-Service\.venv\Scripts\python.exe -m pip install -r AI-Service\requirements.txt
  set "MISSING=1"
)

if "%MISSING%"=="1" (
  echo.
  echo Corrige los requisitos indicados y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if /i "%~1"=="--check" (
  echo Todos los requisitos locales estan listos.
  exit /b 0
)

echo Abriendo Frontend, Backend y AI-Service en terminales separadas...

start "FinSightAI - Frontend" cmd /k "cd /d ""%~dp0frontend"" && title FinSightAI - Frontend && npm run dev"
start "FinSightAI - Backend" cmd /k "cd /d ""%~dp0Backend\backend"" && title FinSightAI - Backend && mvn spring-boot:run"
start "FinSightAI - AI Service" /D "%~dp0AI-Service" cmd /k "title FinSightAI - AI Service && set DEBUG=false&& .venv\Scripts\python.exe -m uvicorn app.main:app --reload"

echo.
echo Servicios:
echo   Frontend:   http://localhost:5173
echo   Backend:    http://localhost:8081
echo   Swagger:    http://localhost:8081/swagger-ui.html
echo   AI-Service: http://localhost:8000
echo   AI Swagger: http://localhost:8000/docs
echo.
endlocal
