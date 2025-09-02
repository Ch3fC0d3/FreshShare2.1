# FreshShare Manual Deployment Script
# This script deploys the FreshShare application directly to a cPanel server via SSH
# PowerShell native implementation (no sshpass required)

# Server credentials - replace these with your actual values
$SERVER_HOST = "your-cpanel-server.com"  # Replace with your server hostname or IP
$SERVER_USER = "your-cpanel-username"    # Replace with your cPanel username
$SERVER_PASS = "your-cpanel-password"    # Replace with your cPanel password

# Create credential object for secure SSH authentication
$SecurePassword = ConvertTo-SecureString $SERVER_PASS -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential ($SERVER_USER, $SecurePassword)

# Server paths
$REMOTE_PATH = "public_html/freshshare"

Write-Host "=== FreshShare Manual Deployment ===" -ForegroundColor Cyan

# Create a temporary deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow
$TEMP_DIR = [System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString()
New-Item -Path $TEMP_DIR -ItemType Directory | Out-Null

# Copy project files to temp directory (excluding node_modules and .git)
Write-Host "Preparing files for deployment..." -ForegroundColor Yellow
$SOURCE_DIR = $PSScriptRoot  # Current directory where this script is located
robocopy $SOURCE_DIR $TEMP_DIR /E /XD "node_modules" ".git" /NFL /NDL /NJH /NJS /nc /ns /np

# Create environment files if they don't exist in the temp dir
if (-not (Test-Path "$TEMP_DIR\.env")) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    @"
# MongoDB Atlas Connection
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=FreshShareDB
PORT=3001
JWT_SECRET=your_jwt_secret
FASTIFY_BACKEND_URL=http://localhost:8080
BASE_URL=
NODE_ENV=production
USDA_API_KEY=your_usda_api_key
"@ | Out-File -FilePath "$TEMP_DIR\.env" -Encoding utf8
}

# Create fastify environment file
if (-not (Test-Path "$TEMP_DIR\fastify-backend\.env")) {
    Write-Host "Creating fastify-backend/.env file..." -ForegroundColor Yellow
    New-Item -Path "$TEMP_DIR\fastify-backend" -ItemType Directory -Force | Out-Null
    @"
PORT=8080
DATABASE_URL=your_database_url
NODE_ENV=production
"@ | Out-File -FilePath "$TEMP_DIR\fastify-backend\.env" -Encoding utf8
}

# Create a zip archive for upload
$DEPLOY_ZIP = "$TEMP_DIR\freshshare-deploy.zip"
Write-Host "Creating deployment zip archive..." -ForegroundColor Yellow
Compress-Archive -Path "$TEMP_DIR\*" -DestinationPath $DEPLOY_ZIP -Force

# Upload to server via SCP (using PowerShell native SSH)
Write-Host "Uploading deployment package to server..." -ForegroundColor Yellow
Write-Host "This requires OpenSSH to be installed on Windows (available in Settings > Apps > Optional Features)" -ForegroundColor Yellow

# Generate deployment script to run on the server
$REMOTE_SCRIPT = "$TEMP_DIR\deploy.sh"
@"
#!/bin/bash
cd ~/public_html
mkdir -p freshshare
cd freshshare

# Extract the uploaded zip file
unzip -o ~/freshshare-deploy.zip

# Install dependencies
npm install --production

# Create startup scripts
echo "#!/bin/bash" > start-backend-prod.sh
echo "cd ~/public_html/freshshare && NODE_ENV=production nohup node server.js > server.log 2>&1 &" >> start-backend-prod.sh
chmod +x start-backend-prod.sh

# Create fastify backend startup script
mkdir -p fastify-backend
echo "#!/bin/bash" > fastify-backend/start-fastify-prod.sh
echo "cd ~/public_html/freshshare/fastify-backend && NODE_ENV=production nohup node index.js > fastify.log 2>&1 &" >> fastify-backend/start-fastify-prod.sh
chmod +x fastify-backend/start-fastify-prod.sh

# Stop any existing processes
pkill -f "node server.js" || echo "No Express server running"
pkill -f "node index.js" || echo "No Fastify server running"

# Start servers
./start-backend-prod.sh
cd fastify-backend && ./start-fastify-prod.sh

# Create cron job to ensure server stays running
CRON_JOB="*/5 * * * * cd ~/public_html/freshshare && ./start-backend-prod.sh >> cron.log 2>&1"
(crontab -l 2>/dev/null | grep -v "freshshare && ./start-backend-prod.sh" || echo "") | { cat; echo "\$CRON_JOB"; } | crontab -

echo "Deployment completed successfully!"
"@ | Out-File -FilePath $REMOTE_SCRIPT -Encoding utf8

Write-Host @"
=== Manual Deployment Instructions ===

Since GitHub Actions is having issues with secrets, follow these steps to deploy manually:

1. Edit this script and set your cPanel credentials at the top:
   - SERVER_HOST
   - SERVER_USER
   - SERVER_PASS

2. Ensure you have OpenSSH installed:
   - Go to Settings > Apps > Optional features
   - Search for "OpenSSH Client" and install if not present

3. Run the script to deploy automatically, or run these commands manually:
   - Use SCP to upload the zip file:
     scp -o StrictHostKeyChecking=no $DEPLOY_ZIP "${SERVER_USER}@${SERVER_HOST}:~/freshshare-deploy.zip"

   - Upload and execute the deployment script:
     scp -o StrictHostKeyChecking=no $REMOTE_SCRIPT "${SERVER_USER}@${SERVER_HOST}:~/deploy.sh"
     ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "chmod +x ~/deploy.sh && ~/deploy.sh"

4. Clean up temporary files
   Remove-Item -Path $TEMP_DIR -Recurse -Force

This will deploy your application directly to the cPanel server without relying on GitHub Actions.
"@ -ForegroundColor Green

# Automated deployment function - uncomment to run fully automated deployment
<#
function Deploy-FreshShare {
    # Check if we have valid credentials
    if ($SERVER_HOST -eq "your-cpanel-server.com" -or 
        $SERVER_USER -eq "your-cpanel-username" -or
        $SERVER_PASS -eq "your-cpanel-password") {
        Write-Host "Please edit the script to set your actual server credentials first." -ForegroundColor Red
        return
    }

    try {
        # Upload files via SCP
        Write-Host "Uploading deployment package..." -ForegroundColor Yellow
        scp -o StrictHostKeyChecking=no $DEPLOY_ZIP "${SERVER_USER}@${SERVER_HOST}:~/freshshare-deploy.zip"
        if ($LASTEXITCODE -ne 0) { throw "Failed to upload deployment package" }

        # Upload deployment script
        Write-Host "Uploading deployment script..." -ForegroundColor Yellow
        scp -o StrictHostKeyChecking=no $REMOTE_SCRIPT "${SERVER_USER}@${SERVER_HOST}:~/deploy.sh"
        if ($LASTEXITCODE -ne 0) { throw "Failed to upload deployment script" }

        # Execute deployment script
        Write-Host "Executing deployment on server..." -ForegroundColor Yellow
        ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "chmod +x ~/deploy.sh && ~/deploy.sh"
        if ($LASTEXITCODE -ne 0) { throw "Deployment script execution failed" }

        Write-Host "Deployment completed successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "Deployment error: $_" -ForegroundColor Red
    }
    finally {
        # Clean up temporary files
        Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
        Remove-Item -Path $TEMP_DIR -Recurse -Force
    }
}

# Uncomment the following line to run automated deployment
# Deploy-FreshShare
#>
