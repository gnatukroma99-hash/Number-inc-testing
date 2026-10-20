@echo off
title CHISLO - git status
if "%~1"=="go" goto MAIN
cmd /k call "%~f0" go
exit /b

:MAIN
cd /d "%~dp0."
cls
git --version 1>nul 2>nul
if errorlevel 1 goto NOGIT

if exist ".git" goto HASGIT
echo [X] Not a git repository in this folder.
goto END

:HASGIT
echo ============ STATUS ============
git status
echo.
echo ============ LAST COMMITS ============
git log --oneline -10
echo.
echo ============ TAGS / VERSIONS ============
git tag --sort=-creatordate
echo.
echo ============ REMOTE ============
git remote -v
goto END

:NOGIT
echo [X] git not found. Install Git for Windows.

:END
echo.
pause
