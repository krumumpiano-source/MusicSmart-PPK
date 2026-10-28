@echo off
rem MusicSmart - local preview (teacher / intern / student). No GitHub Pages, no Apps Script, no internet needed.
rem Double-click this file. Close the window (or press Ctrl+C) to stop. Guide: LOCAL_PREVIEW_TH.md
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js LTS from https://nodejs.org then run this file again.
  pause
  exit /b 1
)
set PORT=8080
echo Starting MusicSmart local preview on http://localhost:%PORT%/ ...
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%/"
node tools\local_server.js %PORT%
echo.
echo Server stopped.
pause
