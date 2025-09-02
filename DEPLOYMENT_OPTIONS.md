# FreshShare Deployment Options

This document outlines the available options for deploying FreshShare to your cPanel hosting environment.

## Option 1: GitHub Actions (with hardcoded credentials)

The GitHub Actions workflow has been updated to use hardcoded credentials instead of GitHub secrets since there appears to be an issue with the secret access in the SSH action.

### Steps:

1. Edit `.github/workflows/deploy-with-secrets-fixed.yml` and replace the placeholder credentials with your actual cPanel details:

```yaml
- name: Deploy to cPanel
  uses: appleboy/ssh-action@v1.0.0
  with:
    host: "your-server-hostname.com"  # Replace with your actual server hostname
    username: "your-cpanel-username"  # Replace with your actual cPanel username
    password: "your-cpanel-password"  # Replace with your actual cPanel password
```

2. Commit and push these changes to trigger the workflow:

```bash
git add .github/workflows/deploy-with-secrets-fixed.yml
git commit -m "Update deployment workflow with server credentials"
git push origin main
```

⚠️ **SECURITY WARNING:** This approach stores your credentials in plain text in your repository. Only use this for private repositories and consider removing the credentials after successful deployment.

## Option 2: Manual Deployment Script (Recommended)

A PowerShell script has been created for manual deployment, which avoids GitHub Actions completely.

### Steps:

1. Edit `manual-deploy.ps1` with your cPanel credentials:

```powershell
$SERVER_HOST = "your-cpanel-server.com"  # Replace with your server hostname or IP
$SERVER_USER = "your-cpanel-username"    # Replace with your cPanel username
$SERVER_PASS = "your-cpanel-password"    # Replace with your cPanel password
```

2. Install required tools:
   - Install sshpass: `choco install sshpass` or `scoop install sshpass`
   - Ensure SSH/SCP is available (usually comes with Git for Windows)

3. Run the script:
   ```powershell
   .\manual-deploy.ps1
   ```

The script will:
- Package your application (excluding node_modules and .git)
- Create necessary environment files if not present
- Upload everything to your cPanel server
- Set up startup scripts for both Express and Fastify backends
- Configure cron jobs for keeping the servers running

## Troubleshooting

If deployment fails, check these common issues:

1. **SSH Connection Problems**
   - Verify your cPanel hostname, username, and password
   - Check if SSH access is enabled on your cPanel account
   - Ensure your IP is not blocked by the server's firewall

2. **File Permission Issues**
   - After deployment, you may need to set permissions: `chmod -R 755 ~/public_html/freshshare`

3. **Node.js Version**
   - Ensure your cPanel server has Node.js 18+ installed
   - If using a different version, update the startup scripts accordingly

4. **Port Access**
   - Check if ports 3001 and 8080 are open and accessible
   - You might need to adjust your application to use cPanel-provided ports

## Server Configuration Reference

The deployment scripts set up:
1. Main Express backend on port 3001
2. Fastify backend on port 8080
3. Cron job to restart services if they crash

After deployment, your application structure on the server will be:
```
~/public_html/freshshare/
├── server.js
├── start-backend-prod.sh
├── .env
├── node_modules/
└── fastify-backend/
    ├── index.js
    ├── start-fastify-prod.sh
    └── .env
```

For further assistance, refer to `cPanel-NODE-SETUP.md` for Node.js setup on cPanel.
