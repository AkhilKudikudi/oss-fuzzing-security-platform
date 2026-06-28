@echo off
:: ════════════════════════════════════════════════════════
:: deploy.bat — Push project to GitHub in one click
:: Run this file AFTER setting up your GitHub repository.
:: ════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════════╗
echo ║     OSS Fuzzing — GitHub Deploy Script       ║
echo ╚══════════════════════════════════════════════╝
echo.

:: STEP 1 — Ask for GitHub username
set /p GHUSER=Enter your GitHub username and press Enter: 

echo.
echo [ Step 1 ] Initializing git...
git init

echo [ Step 2 ] Adding all files...
git add .

echo [ Step 3 ] Creating commit...
git commit -m "Deploy: OSS Fuzzing Security Platform v1.0"

echo [ Step 4 ] Setting branch to main...
git branch -M main

echo [ Step 5 ] Connecting to GitHub repository...
git remote remove origin 2>nul
git remote add origin https://github.com/%GHUSER%/oss-fuzzing-security-platform.git

echo [ Step 6 ] Pushing to GitHub...
git push -u origin main

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  ✅ Code pushed to GitHub successfully!       ║
echo ║                                              ║
echo ║  Now enable GitHub Pages:                    ║
echo ║  1. Go to your repo on GitHub                ║
echo ║  2. Settings → Pages                         ║
echo ║  3. Source: Deploy from branch               ║
echo ║  4. Branch: main  /  Folder: / (root)        ║
echo ║  5. Click Save — wait 2-3 minutes            ║
echo ║                                              ║
echo ║  Your live link will be:                     ║
echo ║  https://%GHUSER%.github.io/oss-fuzzing-security-platform
echo ║                                              ║
echo ╚══════════════════════════════════════════════╝
echo.
pause
