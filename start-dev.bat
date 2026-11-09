@echo off
title KhetKitab Launcher
echo ====================================================
echo Starting KhetKitab Development Servers
echo ====================================================

:: 1. Backend (FastAPI on http://localhost:8000 & 0.0.0.0:8000)
start "KhetKitab - Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\activate && python run.py"

:: 2. Frontend (Next.js on http://localhost:3000)
start "KhetKitab - Frontend (Next.js)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: 3. Mobile (Expo Go on http://localhost:8081)
start "KhetKitab - Mobile (Expo Go)" cmd /k "cd /d "%~dp0mobile" && npx expo start"

echo.
echo All 3 services have been launched in separate terminal windows!
echo - Backend:  http://localhost:8000 (Docs: http://localhost:8000/docs)
echo - Frontend: http://localhost:3000
echo - Expo Go:  Metro bundler on port 8081 (scan QR in Expo terminal)
echo ====================================================
