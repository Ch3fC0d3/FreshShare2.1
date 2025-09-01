# IMPORTANT: Comprehensive FreshShare Deployment Guide for AI Assistants

## Deployment Strategy Overview

The FreshShare application uses a dual-server architecture (Express frontend + Fastify backend) deployed to a cPanel hosting environment through GitHub Actions CI/CD pipeline. This document provides a detailed deployment process specifically designed for AI assistants to understand the system architecture and deployment workflow.

### 1. Repository Structure Analysis

- Identified a Node.js application with Express frontend (`server.js`) and Fastify backend (`fastify-backend/`)
- Located deployment scripts: `deploy-to-production.js` and GitHub workflow file `.github/workflows/deploy-with-secrets-fixed.yml`
- Found deployment configuration in various MD files including `MANUAL_DEPLOYMENT.md` and `FASTIFY_BACKEND_FIX.md`

### 2. Deployment Preparation

- Used `git push` to sync local changes with the GitHub repository
- `git push -u origin main` which triggers the GitHub Actions workflow
- The workflow is configured to deploy when pushes occur to this specific branch

### 3. GitHub Actions Workflow Execution

The workflow (`deploy-with-secrets-fixed.yml`) performs these key steps:

1. **Environment Setup**:
   - Creates `.env` files for both Express and Fastify services
   - Injects secrets from GitHub repository secrets storage (MongoDB URI, JWT secret)
   - Sets up Node.js 18 runtime

2. **Server Preparation**:
   - Generates a production-ready `server.js` for the Fastify backend
   - Creates startup scripts with proper error handling and process management
   - Makes scripts executable with `chmod +x`

3. **Dependency Installation**:
   - Installs Express dependencies for the frontend
   - Installs Fastify, PostgreSQL, and dotenv dependencies for the backend

4. **SSH Deployment**:
   - Configures SSH access using the deployment key stored in GitHub secrets
   - Tests SSH connection before attempting file transfer
   - Creates necessary directories on the remote cPanel server

5. **File Transfer**:
   - Uses SFTP to upload all application files to the server
   - Excludes development-specific directories (.git, .github, etc.)
   - Organizes files into appropriate directories on cPanel

6. **Service Startup**:
   - Activates cPanel Node.js environment
   - Starts the Fastify backend service first (with database connection test)
   - Starts the Express frontend service (which proxies API requests to Fastify)
   - Sets up cron jobs to keep services running and restart if they crash

### 4. Post-Deployment Verification

- Checks process list to ensure services are running
- Inspects logs for startup errors
- Monitors database connection status

## Critical Components

### Base URL Configuration

The application now supports deployment in both root path (`/`) and subdirectory path (`/subdirectory`) configurations through the `BASE_URL` environment variable:

- For root deployment: `BASE_URL=''` (empty string)
- For subdirectory deployment: `BASE_URL='/subdirectory'` (path with leading slash)

This variable is used throughout the application to correctly generate URLs for links, assets, and API calls. Always set this variable to match your actual deployment path.

### Environment Configuration
```
# Express .env
PORT=3001
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/freshshare
JWT_SECRET=your-jwt-secret-key
FASTIFY_BACKEND_URL=http://localhost:8080
BASE_URL=/subdirectory  # Use '' for root deployment or '/subdirectory' for subdirectory path

# Fastify .env  
PORT=8080
NODE_ENV=production
DATABASE_URL=postgres://myfrovov_freshshare_user:password@localhost:5432/myfrovov_freshshare
```

### Process Management
- Startup scripts handle Node.js environment activation
- PID files track running processes
- Error logging captures startup failures
- Cron jobs ensure services restart after crashes or server reboots

### Proxy Configuration
`.htaccess` file configures Apache to proxy API requests to the Fastify backend running on port 8080, while serving frontend content directly.

## Troubleshooting Guide

The deployment includes robust error handling:
- Service status monitoring
- Database connection testing
- Comprehensive logging
- Fallback mechanisms for Node.js path detection
- Automated recovery through cron jobs

### GitHub Actions Docker Errors

If you encounter errors like `Error: missing server host` in GitHub Actions, check the following:

1. **GitHub Secrets Configuration**: Ensure all required secrets are properly set in GitHub repository settings.
   - Navigate to your repository → Settings → Secrets and variables → Actions → Repository secrets
   - Verify these critical secrets exist: `SERVER_HOST`, `SERVER_USER`, and `SERVER_PASS`
   - For the `SERVER_HOST` value, use your cPanel hostname (e.g., premium149.web-hosting.com)

2. **Docker Command Execution**: When GitHub Actions displays errors like:

   ```bash
   /usr/bin/docker run --name [container-id] ... -e "INPUT_HOST" -e "INPUT_USERNAME" -e "INPUT_PASSWORD" ...
   Error: missing server host
   ```

   This indicates that the SSH action cannot access the required secrets.

## Implementation Details

The deployment leverages GitHub secrets for sensitive configuration, ensuring database credentials and SSH keys remain secure. The dual-server architecture separates concerns between the frontend user interface (Express) and the backend API (Fastify), with proper communication between them.

Both synchronous deployment (via GitHub Actions) and manual deployment options are available, providing flexibility based on environment constraints.

## For AI Assistants: Understanding Key Workflow Components

### GitHub Workflow Structure

```yaml
name: Deploy to cPanel

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    # Allow manual triggering

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    # ... (additional steps)
```

### GitHub Secrets for Deployment
The workflow uses GitHub secrets to securely connect to the cPanel server. The following secrets must be configured in your GitHub repository:

1. **SERVER_HOST**: Your cPanel server hostname (e.g., premium149.web-hosting.com)
2. **SERVER_USER**: Your cPanel username (e.g., myfrovov)
3. **SERVER_PASS**: Your cPanel password
4. **MONGODB_URI**: Connection string to your MongoDB database
5. **JWT_SECRET**: Secret key for JWT authentication
6. **DATABASE_URL**: Connection string to your PostgreSQL database
7. **BASE_URL**: Deployment path (empty for root deployment or '/subdirectory' for subdirectory)
8. **USDA_API_KEY**: API key for USDA services

### Environment File Creation
Environment files (.env) are created dynamically during the workflow execution, with sensitive values injected from GitHub secrets:

```yaml
- name: Create Express .env file
  run: |
    echo "# MongoDB Atlas Connection" > .env
    echo "MONGODB_URI=${{ secrets.MONGODB_URI }}" >> .env
    echo "MONGODB_DB=FreshShareDB" >> .env
    echo "PORT=3001" >> .env
    echo "JWT_SECRET=${{ secrets.JWT_SECRET }}" >> .env
    echo "FASTIFY_BACKEND_URL=http://localhost:8080" >> .env
    echo "BASE_URL=${{ secrets.BASE_URL || '' }}" >> .env
    echo "NODE_ENV=production" >> .env
```

### Server Startup Script Generation
The workflow generates startup scripts that handle process management, environment loading, and error handling:

```bash
#!/bin/bash
export PATH=$HOME/nodevenv/freshshare1.3/14/bin:$PATH
cd $HOME/public_html

# Load environment variables
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check for dependencies
if [ ! -d "node_modules" ] || [ ! -d "node_modules/express" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the server
echo "Starting Express server on port $PORT..."
node server.js > express.log 2>&1 &
echo $! > express.pid
echo "Express server started with PID $(cat express.pid)"
```

### Process Management and Monitoring
The deployment creates PID files and sets up cron jobs to ensure services remain running:

```bash
# Create a cron job to ensure the server stays running
# Will check every 5 minutes and restart if needed
CRON_JOB="*/5 * * * * cd $TARGET_DIR && ./start-backend-prod.sh >> cron.log 2>&1"
(crontab -l 2>/dev/null | grep -v "fastify-backend && ./start-backend-prod.sh" || echo "") | { cat; echo "$CRON_JOB"; } | crontab -
echo "✅ Added cron job to keep backend running"
```

## Conclusion

The FreshShare deployment process represents a comprehensive approach to deploying a dual-server Node.js application to a cPanel hosting environment. The combination of GitHub Actions for CI/CD, environment-specific configuration management, robust process handling, and automated recovery mechanisms ensures a reliable production deployment.
