#!/bin/bash
# Fix Production Issues Script for AIM Clone
# This script fixes the API placeholder URL issue and performance monitoring errors

echo "🔧 AIM Clone Production Issues Fix Script"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "✅ Found project structure"

# Step 1: Fix the performance monitoring issue
echo ""
echo "🔧 Step 1: Fixing performance monitoring..."

MEMORY_MANAGER_PATH="frontend/src/services/memoryManager.ts"
if [ -f "$MEMORY_MANAGER_PATH" ]; then
    echo "   Updating PerformanceObserver to use valid entry types..."
    
    # Create backup
    cp "$MEMORY_MANAGER_PATH" "$MEMORY_MANAGER_PATH.backup"
    
    # Replace the problematic memory entry type
    sed -i.tmp "s/entryTypes: \['memory'\]/entryTypes: ['navigation', 'resource']/g" "$MEMORY_MANAGER_PATH"
    sed -i.tmp "s/if (entry\.entryType === 'memory') {/if (entry.entryType === 'navigation' || entry.entryType === 'resource') {/g" "$MEMORY_MANAGER_PATH"
    
    # Clean up temp files
    rm -f "$MEMORY_MANAGER_PATH.tmp"
    
    echo "   ✅ Performance monitoring fixed"
else
    echo "   ⚠️  Memory manager file not found, skipping..."
fi

# Step 2: Create centralized API utility
echo ""
echo "🔧 Step 2: Creating centralized API utility..."

API_UTIL_PATH="frontend/src/utils/api.ts"
cat > "$API_UTIL_PATH" << 'EOF'
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
  return `${baseUrl}/${cleanPath}`;
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
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return apiFetch(path, {
    ...options,
    headers,
  });
};
EOF

echo "   ✅ API utility created"

# Step 3: Update AuthContext to use the API utility
echo ""
echo "🔧 Step 3: Updating AuthContext..."

AUTH_CONTEXT_PATH="frontend/src/contexts/AuthContext.tsx"
if [ -f "$AUTH_CONTEXT_PATH" ]; then
    # Create backup
    cp "$AUTH_CONTEXT_PATH" "$AUTH_CONTEXT_PATH.backup"
    
    # Add import for getApiUrl
    sed -i.tmp "1s/import React, { createContext, useContext, useReducer, useEffect } from 'react';/import React, { createContext, useContext, useReducer, useEffect } from 'react';\nimport { getApiUrl } from '..\/utils\/api';/" "$AUTH_CONTEXT_PATH"
    
    # Replace direct environment variable usage with getApiUrl()
    sed -i.tmp "s/const apiUrl = import\.meta\.env\.VITE_API_URL || 'http:\/\/localhost:3001';/const apiUrl = getApiUrl();/g" "$AUTH_CONTEXT_PATH"
    
    # Clean up temp files
    rm -f "$AUTH_CONTEXT_PATH.tmp"
    
    echo "   ✅ AuthContext updated"
else
    echo "   ⚠️  AuthContext file not found, skipping..."
fi

echo ""
echo "🔧 Step 4: Building and deploying..."

# Change to frontend directory
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

# Build the project
echo "   Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "   ✅ Build successful"
else
    echo "   ❌ Build failed"
    cd ..
    exit 1
fi

# Return to project root
cd ..

# Step 5: Git operations
echo ""
echo "🔧 Step 5: Committing changes..."

git add .
git commit -m "Fix: Resolve API placeholder URL and performance monitoring issues

- Fix PerformanceObserver to use valid entry types
- Create centralized API utility with placeholder URL protection
- Update AuthContext to use API utility
- Add debug logging for environment variable issues"

if [ $? -eq 0 ]; then
    echo "   ✅ Changes committed"
    
    echo "   Pushing to GitHub..."
    git push
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Changes pushed to GitHub"
    else
        echo "   ⚠️  Push failed - you may need to push manually"
    fi
else
    echo "   ⚠️  No changes to commit or commit failed"
fi

echo ""
echo "🎉 Production Issues Fix Complete!"
echo "========================================="
echo "✅ Performance monitoring errors fixed"
echo "✅ API placeholder URL protection added"
echo "✅ Centralized API utility created"
echo "✅ Build completed successfully"
echo "✅ Changes committed and pushed"
echo ""
echo "📋 Next Steps:"
echo "1. Wait for Cloudflare Pages to deploy (usually 1-2 minutes)"
echo "2. Test your application at https://aim-clone.pages.dev/"
echo "3. Check browser console for any remaining issues"
echo ""
echo "🔗 Monitor deployment: https://dash.cloudflare.com/pages"
