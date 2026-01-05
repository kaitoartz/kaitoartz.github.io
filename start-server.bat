@echo off
echo ========================================
echo   KAITOARTZ - Local Server Launcher
echo ========================================
echo.
echo Starting server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
echo Opening browser...
echo.
timeout /t 2 /nobreak > nul
start http://localhost:8000
python -m http.server 8000
