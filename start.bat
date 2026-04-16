@echo off
title TimeScope Launcher
color 0A

echo.
echo  ==========================================
echo   ⏱  TimeScope - Starting all services
echo  ==========================================
echo.

:: Check Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo  [ERROR] Node.js not found. Please install from https://nodejs.org
  pause & exit /b 1
)

:: Install launcher deps if needed
if not exist "launcher\node_modules" (
  echo  [Setup] Installing launcher dependencies...
  cd launcher
  call npm install
  cd ..
)

:: Start the launcher server in a new window
echo  [1/4] Starting Launcher server...
start "TimeScope Launcher" cmd /k "cd launcher && node server.js"

timeout /t 2 /nobreak >nul

:: Start Ollama
echo  [2/4] Starting Ollama...
start "Ollama" cmd /k "ollama serve"

timeout /t 2 /nobreak >nul

:: Open the React frontend (or start dev server)
echo  [3/4] Opening TimeScope dashboard...
start "" "http://localhost:5173/setup"

:: Optionally start frontend dev server
:: Uncomment if not already running:
start "Frontend Dev" cmd /k "cd frontend && npm run dev"

echo.
echo  ==========================================
echo   All services launching!
echo   Dashboard: http://localhost:5173
echo   Setup:     http://localhost:5173/setup
echo  ==========================================
echo.
pause