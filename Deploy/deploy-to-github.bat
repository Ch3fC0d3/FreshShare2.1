@echo off
echo FreshShare GitHub Deployment Script
echo ====================================

cd /d D:\Users\gabep\Desktop\FreshShare1.2

REM Configure Git
git config --global core.sshCommand "ssh -i %~dp0freshshare_deploy_key"
git config --global core.autocrlf false
git config --global user.name "FreshShare Deploy"
git config --global user.email "deploy@freshshare.local"

REM Initialize repository if needed
if not exist .git (
    git init
    git remote add origin https://github.com/Ch3fC0d3/FreshShare2.1.git
)

REM Create and switch to main branch
git checkout -b main 2>nul || git checkout main

echo Adding all project files...
git add .

echo Committing changes...
git commit -m "fix: MongoDB dependency, workflow issues, and 503 error resolution

- Fix missing dependencies in mongodb-bypass.js
- Add graceful error handling for dotenv and mongoose
- Ensure workflow continues even if dependencies are missing
- Update GitHub Actions workflow to install dependencies properly
- Fix corrupted SSH action script in workflow file
- Fix DATABASE_SSL context access issue in workflow
- Create separate Node.js detection script for reliable production setup
- Update workflow to use dedicated Node.js detection script
- Use deploy-with-secrets-fixed-new.yml instead of broken workflow file
- Add Windows-compatible 503 error fix script (fix-503-error-windows.js)
- Add production-ready 503 error fix script (503-fix-production.sh)
- Fix Apache proxy configuration in .htaccess for proper routing"

echo Pushing to GitHub...
git push -u origin main

echo Done!
pause
