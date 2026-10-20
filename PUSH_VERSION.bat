@echo off
title CHISLO - push new version
if "%~1"=="go" goto MAIN
cmd /k call "%~f0" go
exit /b

:MAIN
cd /d "%~dp0."
cls
echo ======================================================
echo    CHISLO  -  publish new version
echo ======================================================
echo.

git --version 1>nul 2>nul
if errorlevel 1 goto NOGIT

if exist ".git" goto HASGIT
echo [X] This folder is not a git repository yet.
echo     Run PUBLISH_SETUP.bat first.
goto END

:HASGIT
set VER=0.0.0
if not exist "VERSION" goto HAVER
for /f "usebackq delims=" %%v in ("VERSION") do set VER=%%v

:HAVER
echo Version in VERSION file: %VER%
echo.
echo Reminder: bump VERSION and update docs\CHANGELOG.md before publishing.
echo.

set /p MSG=Comment for this version (Enter = update): 
if "%MSG%"=="" set MSG=update

echo.
echo [1/4] add
git add -A

echo [2/4] commit
git commit -m "v%VER%: %MSG%"

echo [3/4] tag v%VER%
git tag -f -a "v%VER%" -m "v%VER% - %MSG%"

echo [4/4] push
git push origin main
git push --tags -f
if errorlevel 1 goto PUSHFAIL

echo.
echo ======================================================
echo   DONE: v%VER% published
echo   Tags: git tag
echo ======================================================
goto END

:NOGIT
echo.
echo [X] git not found. Install Git for Windows first.
goto END

:PUSHFAIL
echo.
echo [X] Push failed. Check internet and GitHub login.
goto END

:END
echo.
pause
