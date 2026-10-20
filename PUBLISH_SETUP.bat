@echo off
title CHISLO - publish setup
if "%~1"=="go" goto MAIN
cmd /k call "%~f0" go
exit /b

:MAIN
cd /d "%~dp0."
cls
echo ======================================================
echo    CHISLO  -  first publish to GitHub
echo ======================================================
echo.

git --version 1>nul 2>nul
if errorlevel 1 goto NOGIT

for /f "delims=" %%v in ('git config user.name 2^>nul') do set GITNAME=%%v
if not "%GITNAME%"=="" goto HAVEID

echo Git does not know your name yet. Enter it once:
echo.
set /p GITNAME=Your name on GitHub: 
set /p GITMAIL=Your email on GitHub: 
git config --global user.name "%GITNAME%"
git config --global user.email "%GITMAIL%"

:HAVEID
echo.
echo Create an EMPTY repository on GitHub first:
echo    github.com - New repository - name - NO readme - Create
echo.
set /p GHUSER=GitHub username: 
set /p GHREPO=Repository name: 

if "%GHUSER%"=="" goto NOUSER
if "%GHREPO%"=="" goto NOUSER

echo.
if exist ".git" goto HASGIT
echo [1/5] git init
git init
git branch -M main
goto AFTERINIT

:HASGIT
echo [1/5] repository already initialized

:AFTERINIT
echo [2/5] commit
git add -A
git commit -m "v0.1.1 - framework, 3 mechanics, cloud saves"

echo [3/5] remote
git remote remove origin 1>nul 2>nul
git remote add origin https://github.com/%GHUSER%/%GHREPO%.git

echo [4/5] push
echo      GitHub may open a login window. That is normal.
git push -u origin main
if errorlevel 1 goto PUSHFAIL

echo.
echo [5/5] DONE
echo ======================================================
echo   Repository: https://github.com/%GHUSER%/%GHREPO%
echo.
echo   Next versions: run PUSH_VERSION.bat
echo   Online play: Settings - Pages - Branch main - Save
echo   https://%GHUSER%.github.io/%GHREPO%/
echo ======================================================
goto END

:NOGIT
echo.
echo [X] git not found.
echo     Install Git for Windows: https://git-scm.com/download/win
goto END

:NOUSER
echo.
echo [X] Username and repository name are both required. Run again.
goto END

:PUSHFAIL
echo.
echo [X] Push failed. Check:
echo     - the repository exists on GitHub and is empty
echo     - username and repository name are correct
echo     - you logged in in the GitHub popup
goto END

:END
echo.
pause
