@echo off
setlocal

set "REPO_URL=https://github.com/Nikola0803/connect767.git"
set "BRANCH=main"

cd /d "%~dp0"

echo ============================================
echo   CONNECT767 - Deploy to GitHub
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH.
    echo Install it from https://git-scm.com/download/win and run this file again.
    pause
    exit /b 1
)

if exist ".git" (
    echo Wiping existing git history for a clean push...
    rmdir /s /q ".git"
)

echo Initializing git repository...
git init

git branch -M %BRANCH%

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo Adding remote origin...
    git remote add origin %REPO_URL%
) else (
    echo Remote origin already set.
)

if not exist ".gitignore" (
    echo Creating .gitignore...
    (
        echo node_modules/
        echo dist/
        echo build/
        echo .next/
        echo .env
        echo .env.local
        echo .env.production
    ) > .gitignore
)

echo.
echo Removing node_modules and build output from tracking (if present)...
git rm -r --cached node_modules >nul 2>nul
git rm -r --cached dist >nul 2>nul
git rm -r --cached build >nul 2>nul
git rm -r --cached .next >nul 2>nul

echo Staging all changes...
git add -A

git diff --cached --quiet
if errorlevel 1 (
    echo Committing...
    git commit -m "Deploy %date% %time%"
) else (
    echo No local changes to commit.
)

echo.
echo Pushing to GitHub...
git push -u origin %BRANCH% --force

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed - see messages above.
    echo If a browser/credential window popped up, sign in to GitHub then run this file again.
) else (
    echo.
    echo Done. Pushed to %REPO_URL%
    echo On the VPS: git clone %REPO_URL% then npm install && npm run build
)

echo.
pause
endlocal
