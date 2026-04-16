@echo off
title TimeScope
color 0A
cd /d "%~dp0"

echo.
echo  ==========================================
echo   TimeScope - Starting all services
echo  ==========================================
echo.

:: Check Node
where node >nul 2>nul || (echo [ERROR] Node.js not found. && pause & exit /b 1)
:: Check Python
where python >nul 2>nul || (echo [ERROR] Python not found. && pause & exit /b 1)
:: Check Java / Maven
where mvn >nul 2>nul || (
  if not exist "backend\mvnw.cmd" (echo [ERROR] Maven not found. && pause & exit /b 1)
)

:: Install launcher deps if needed
if not exist "launcher\node_modules" (
  echo  [Setup] Installing launcher dependencies...
  cd launcher && call npm install && cd ..
)

:: Install frontend deps if needed
if not exist "frontend\node_modules" (
  echo  [Setup] Installing frontend dependencies...
  cd frontend && call npm install && cd ..
)

echo  [1/5] Starting Launcher server (port 3001)...
start "TimeScope Launcher" cmd /k "cd /d "%~dp0launcher" && node server.js"

timeout /t 1 /nobreak >nul

echo  [2/5] Starting Spring Boot backend (port 8080)...
start "TimeScope Backend" cmd /k "cd /d "%~dp0backend" && mvnw.cmd spring-boot:run"

timeout /t 1 /nobreak >nul

echo  [3/5] Starting Python logger...
start "TimeScope Logger" cmd /k "cd /d "%~dp0logger" && python main.py"

timeout /t 1 /nobreak >nul

echo  [4/5] Starting Vite frontend (port 5173)...
start "TimeScope Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 1 /nobreak >nul

echo  [5/5] Starting Ollama...
start "Ollama" cmd /k "ollama serve"

echo.
echo  Waiting for backend to come up (~30s)...
timeout /t 30 /nobreak >nul

echo.
echo  ==========================================
echo   All services launched!
echo   Dashboard : http://localhost:5173
echo   Setup     : http://localhost:5173/setup
echo   Launcher  : http://localhost:3001
echo  ==========================================
echo.

start "" "http://localhost:5173"

pause
