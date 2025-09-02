@echo off
echo FreshShare GitHub Deployment Script
echo ====================================

cd /d D:\Users\gabep\Desktop\FreshShare1.2

REM Configure Git
git config --global user.name "FreshShare Deploy"
git config --global user.email "deploy@freshshare.local"

REM Initialize repository if needed
if not exist .git (
    git init
    git remote add origin https://github.com/Ch3fC0d3/FreshShare2.1.git
)

REM Create and switch to main branch
git checkout -b main 2>nul || git checkout main

REM Pull the latest changes first
echo Pulling latest changes from remote...
git pull origin main

echo Adding all project files...
git add .

echo Committing changes...
git commit -m "fix: Update deployment configuration and GitHub workflow

- Fix SERVER_HOST, SERVER_USER, and SERVER_PASS configuration
- Update workflow to properly handle secrets
- Update documentation with correct deployment instructions
- Fix branch references to use main branch instead of restore_branch"

echo Pushing to GitHub...
git push -u origin main

echo Done!
pause
