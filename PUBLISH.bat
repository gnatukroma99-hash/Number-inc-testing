@echo off
title CHISLO - bump version and push
if "%~1"=="go" goto MAIN
cmd /k call "%~f0" go %*
exit /b

:MAIN
cd /d "%~dp0"
cls
echo ======================================================
echo    CHISLO  -  bump version, check, push to GitHub
echo ======================================================
echo.
echo  Usage:  PUBLISH.bat            patch bump 0.12.2 -^> 0.12.3
echo          PUBLISH.bat minor      minor bump 0.12.2 -^> 0.13.0
echo          PUBLISH.bat major      major bump 0.12.2 -^> 1.0.0
echo          PUBLISH.bat 0.13.5     explicit version
echo          PUBLISH.bat keep       publish current version, no bump
echo          PUBLISH.bat fast       no tests, no bump (quick push)
echo.

node --version 1>nul 2>nul
if errorlevel 1 goto NONODE

if exist ".git" goto HASGIT
echo [X] This folder is not a git repository yet.
echo     Run PUBLISH_SETUP.bat first.
goto END

:HASGIT
set MODE=%~2
if "%MODE%"=="" set MODE=patch
echo Mode: %MODE%
echo.

if /i "%MODE%"=="keep" goto NOBUMP
if /i "%MODE%"=="fast" goto NOBUMP
node tools/bump.js %MODE%
if errorlevel 1 goto FAIL
:NOBUMP

set VER=0.0.0
for /f "usebackq delims=" %%v in ("VERSION") do set VER=%%v
echo.
echo Version: %VER%
echo.

echo ============ CHECKS ============
node tools/checkall.js
if errorlevel 1 goto FAIL
if /i "%MODE%"=="fast" goto GIT

if exist "node_modules\jsdom" goto HASDOM
echo [!] node_modules missing - skipping domtest/bench
echo     run "npm i" once to enable them
goto GIT
:HASDOM
node tools/domtest.js
if errorlevel 1 goto FAIL
node tools/bench.js 1 300
if errorlevel 1 goto FAIL

:GIT
echo.
echo ============ GIT ============
git add -A
git commit -m "v%VER%: update"
git tag v%VER% 1>nul 2>nul
echo.
echo --- pull before push ---
git pull --rebase
echo.
echo --- push ---
git push origin HEAD
if errorlevel 1 goto FAIL
git push origin --tags
goto DONE

:FAIL
echo.
echo [X] FAILED - read the messages above. Nothing was pushed.
goto END

:DONE
echo.
echo [OK] v%VER% is on GitHub.
echo      Game:    https://gnatukroma99-hash.github.io/Number-inc-testing/
echo      Actions: https://github.com/gnatukroma99-hash/Number-inc-testing/actions
goto END

:NONODE
echo [X] Node.js is not installed or not in PATH.
goto END

:END
echo.
pause
exit /b 0
