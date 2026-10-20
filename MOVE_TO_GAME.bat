@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ================================================
echo  Perenos proekta v papku  game\
echo ================================================
echo.

if exist "game\index.html" (
  echo Uzhe pereneseno: game\index.html na meste.
  echo Nichogo ne delayu.
  pause
  exit /b 0
)

if not exist "game" mkdir "game"

if exist "index.html" move /y "index.html" "game\" >nul
if exist "src"        move /y "src"        "game\" >nul
if exist "assets"     move /y "assets"     "game\" >nul
if exist "docs"       move /y "docs"       "game\" >nul
if exist "tools"      move /y "tools"      "game\" >nul

echo.
echo Gotovo. Struktura:
echo   game\index.html   - igra
echo   game\src          - kod
echo   game\assets       - stil
echo   game\docs         - dokumentaciya
echo   game\tools        - simulyator balansa
echo.
echo Otkryvay: game\index.html
pause
