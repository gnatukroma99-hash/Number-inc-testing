@echo off
title CHISLO - pull from GitHub
if "%~1"=="go" goto MAIN
cmd /k call "%~f0" go
exit /b

:MAIN
cd /d "%~dp0"
cls
echo ======================================================
echo    CHISLO  -  pull latest version from GitHub
echo ======================================================
echo.

node --version 1>nul 2>nul
if errorlevel 1 goto NONODE

if exist ".git" goto HASGIT
echo [X] This folder is not a git repository yet.
echo     Run PUBLISH_SETUP.bat first.
goto END

:HASGIT
git pull --rebase --autostash
set VER=0.0.0
for /f "usebackq delims=" %%v in ("VERSION") do set VER=%%v
echo.
echo Version now: %VER%
echo Open index.html and press Ctrl+F5 to reload the game.
goto END

:NONODE
echo [X] Node.js is not installed or not in PATH.

:END
echo.
pause
exit /b 0
