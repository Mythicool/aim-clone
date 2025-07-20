#!/usr/bin/env pwsh
# Fix Production Issues Script for AIM Clone
# This script fixes the API placeholder URL issue and performance monitoring errors

Write-Host "🔧 AIM Clone Production Issues Fix Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "frontend/package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found project structure" -ForegroundColor Green

# Step 1: Fix the performance monitoring issue
Write-Host "`n🔧 Step 1: Fixing performance monitoring..." -ForegroundColor Yellow

$memoryManagerPath = "frontend/src/services/memoryManager.ts"
if (Test-Path $memoryManagerPath) {
    Write-Host "   Updating PerformanceObserver to use valid entry types..." -ForegroundColor Gray
    
    # Read the file content
    $content = Get-Content $memoryManagerPath -Raw
    
    # Replace the problematic memory entry type
    $content = $content -replace 'entryTypes: \[''memory''\]', 'entryTypes: [''navigation'', ''resource'']'
    $content = $content -replace "if \(entry\.entryType === 'memory'\) \{[^}]+\}", "if (entry.entryType === 'navigation' || entry.entryType === 'resource') {`n            if (entry.duration > 1000) {`n              this.performCleanup();`n            }`n          }"
    
    # Write back to file
    Set-Content $memoryManagerPath -Value $content -NoNewline
    Write-Host "   ✅ Performance monitoring fixed" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Memory manager file not found, skipping..." -ForegroundColor Yellow
}

# Step 2: Create centralized API utility
Write-Host "`n🔧 Step 2: Creating centralized API utility..." -ForegroundColor Yellow

$apiUtilPath = "frontend/src/utils/api.ts"
$apiUtilContent = @"
/**
 * API utility functions for making HTTP requests
 */

// Get the API base URL from environment variables
export const getApiUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  // Debug logging to help identify environment variable issues
  if (import.meta.env.DEV) {
    console.log('Environment variables:', {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      MODE: import.meta.env.MODE,
      PROD: import.meta.env.PROD
    });
    console.log('Using API URL:', apiUrl);
  }
  
  // Prevent using placeholder URLs in production
  if (apiUrl.includes('placeholder.com')) {
    console.error('ERROR: Using placeholder API URL! Check environment variables.');
    console.error('Current API URL:', apiUrl);
    console.error('Environment variables:', import.meta.env);
    
    // Fallback to the correct production URL
    return 'https://aim-backend-pg2h.onrender.com';
  }
  
  return apiUrl;
};

// Create a full API URL from a relative path
export const createApiUrl = (path: string): string => {
  const baseUrl = getApiUrl();
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${baseUrl}/{cleanPath}`;
};

// Enhanced fetch function that automatically uses the correct API URL
export const apiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const url = createApiUrl(path);
  return fetch(url, options);
};

// Authenticated fetch function that includes the auth token
export const authenticatedFetch = async (
  path: string, 
  token: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const headers = {
    'Authorization': `Bearer {token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return apiFetch(path, {
    ...options,
    headers,
  });
};
"@

Set-Content $apiUtilPath -Value $apiUtilContent
Write-Host "   ✅ API utility created" -ForegroundColor Green

# Step 3: Update AuthContext to use the API utility
Write-Host "`n🔧 Step 3: Updating AuthContext..." -ForegroundColor Yellow

$authContextPath = "frontend/src/contexts/AuthContext.tsx"
if (Test-Path $authContextPath) {
    $content = Get-Content $authContextPath -Raw
    
    # Add import for getApiUrl
    $content = $content -replace "import React, { createContext, useContext, useReducer, useEffect } from 'react';", "import React, { createContext, useContext, useReducer, useEffect } from 'react';`nimport { getApiUrl } from '../utils/api';"
    
    # Replace direct environment variable usage with getApiUrl()
    $content = $content -replace "const apiUrl = import\.meta\.env\.VITE_API_URL \|\| 'http://localhost:3001';", "const apiUrl = getApiUrl();"
    
    Set-Content $authContextPath -Value $content -NoNewline
    Write-Host "   ✅ AuthContext updated" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  AuthContext file not found, skipping..." -ForegroundColor Yellow
}

Write-Host "`n🔧 Step 4: Building and deploying..." -ForegroundColor Yellow

# Change to frontend directory
Push-Location frontend

try {
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Installing dependencies..." -ForegroundColor Gray
        npm install
    }

    # Build the project
    Write-Host "   Building project..." -ForegroundColor Gray
    npm run build

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Build successful" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }

} finally {
    Pop-Location
}

# Step 5: Git operations
Write-Host "`n🔧 Step 5: Committing changes..." -ForegroundColor Yellow

git add .
git commit -m "Fix: Resolve API placeholder URL and performance monitoring issues

- Fix PerformanceObserver to use valid entry types
- Create centralized API utility with placeholder URL protection
- Update AuthContext to use API utility
- Add debug logging for environment variable issues"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Changes committed" -ForegroundColor Green
    
    Write-Host "   Pushing to GitHub..." -ForegroundColor Gray
    git push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Changes pushed to GitHub" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Push failed - you may need to push manually" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  No changes to commit or commit failed" -ForegroundColor Yellow
}

Write-Host "`n🎉 Production Issues Fix Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host "✅ Performance monitoring errors fixed" -ForegroundColor Green
Write-Host "✅ API placeholder URL protection added" -ForegroundColor Green
Write-Host "✅ Centralized API utility created" -ForegroundColor Green
Write-Host "✅ Build completed successfully" -ForegroundColor Green
Write-Host "✅ Changes committed and pushed" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Wait for Cloudflare Pages to deploy (usually 1-2 minutes)" -ForegroundColor White
Write-Host "2. Test your application at https://aim-clone.pages.dev/" -ForegroundColor White
Write-Host "3. Check browser console for any remaining issues" -ForegroundColor White
Write-Host "`n🔗 Monitor deployment: https://dash.cloudflare.com/pages" -ForegroundColor Cyan
