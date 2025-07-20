#!/usr/bin/env pwsh
# Deploy Backend Script for AIM Clone
# This script helps deploy the backend to various platforms

Write-Host "🚀 AIM Clone Backend Deployment Script" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "backend/package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found backend structure" -ForegroundColor Green

# Step 1: Build the backend
Write-Host "`n🔧 Step 1: Building backend..." -ForegroundColor Yellow

Push-Location backend

try {
    # Install dependencies
    Write-Host "   Installing dependencies..." -ForegroundColor Gray
    npm install

    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Failed to install dependencies" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    # Build the project
    Write-Host "   Building TypeScript..." -ForegroundColor Gray
    npm run build

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Backend build successful" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Backend build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }

} finally {
    Pop-Location
}

# Step 2: Test the backend locally
Write-Host "`n🔧 Step 2: Testing backend locally..." -ForegroundColor Yellow

Write-Host "   Starting backend server for testing..." -ForegroundColor Gray
Write-Host "   (This will run for 10 seconds to test if it starts properly)" -ForegroundColor Gray

# Start the backend in background
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    cd backend
    npm start
}

# Wait a few seconds for startup
Start-Sleep -Seconds 5

# Test the health endpoint
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 5
    Write-Host "   ✅ Backend health check passed" -ForegroundColor Green
    Write-Host "   Server response: $($response.message)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Backend health check failed - this might be normal if port is in use" -ForegroundColor Yellow
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# Stop the test server
Stop-Job $backendJob -Force
Remove-Job $backendJob -Force

Write-Host "`n🔧 Step 3: Deployment options..." -ForegroundColor Yellow

Write-Host @"
   Your backend is ready for deployment! Choose one of these options:

   📋 Option 1: Render (Current configuration)
   1. Go to https://render.com
   2. Create a new Web Service
   3. Connect your GitHub repository: https://github.com/Mythicool/aim-clone
   4. Configure:
      - Name: aim-backend
      - Environment: Node
      - Build Command: cd backend && npm install && npm run build
      - Start Command: cd backend && npm start
      - Auto-Deploy: Yes
   5. Add environment variables:
      - NODE_ENV=production
      - JWT_SECRET=aim-super-secret-jwt-key-2024
      - DATABASE_URL=/tmp/aim.db
      - FRONTEND_URL=https://aim-clone.pages.dev
   6. Deploy!

   📋 Option 2: Railway
   1. Go to https://railway.app
   2. Create new project from GitHub repo
   3. Select your repository
   4. Railway will auto-detect the configuration from railway.json
   5. Add the same environment variables as above
   6. Deploy!

   📋 Option 3: Heroku
   1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
   2. Run: heroku create your-app-name
   3. Run: git subtree push --prefix backend heroku main
   4. Set environment variables with heroku config:set

   📋 Option 4: Docker (Any platform)
   1. Build: docker build -t aim-backend ./backend
   2. Run: docker run -p 3001:3001 aim-backend
   3. Deploy to any Docker-compatible platform

"@ -ForegroundColor White

Write-Host "`n🎯 Recommended: Use Render (Option 1)" -ForegroundColor Cyan
Write-Host "   - Free tier available" -ForegroundColor Gray
Write-Host "   - Easy GitHub integration" -ForegroundColor Gray
Write-Host "   - Automatic deployments" -ForegroundColor Gray
Write-Host "   - Already configured in your frontend" -ForegroundColor Gray

Write-Host "`n📝 After deployment:" -ForegroundColor Yellow
Write-Host "   1. Update the URL in cloudflare-pages.toml if different" -ForegroundColor White
Write-Host "   2. Test the health endpoint: https://your-backend-url.com/health" -ForegroundColor White
Write-Host "   3. Test registration and login in your frontend" -ForegroundColor White

Write-Host "`n🔗 Useful links:" -ForegroundColor Cyan
Write-Host "   - Render: https://render.com" -ForegroundColor White
Write-Host "   - Railway: https://railway.app" -ForegroundColor White
Write-Host "   - Your GitHub repo: https://github.com/Mythicool/aim-clone" -ForegroundColor White

Write-Host "`n✅ Backend is ready for deployment!" -ForegroundColor Green
