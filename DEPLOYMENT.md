# Deployment Guide

This guide covers deploying the AOL Instant Messenger Clone to Cloudflare Pages.

## Prerequisites

1. **GitHub Repository**: Your code should be pushed to a GitHub repository
2. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
3. **Backend Deployment**: You'll need to deploy the backend separately (see Backend Deployment section)

## Frontend Deployment to Cloudflare Pages

### Method 1: Cloudflare Dashboard (Recommended for first deployment)

1. **Login to Cloudflare Dashboard**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to "Pages" in the sidebar

2. **Create a New Project**
   - Click "Create a project"
   - Choose "Connect to Git"
   - Select your GitHub repository

3. **Configure Build Settings**
   - **Framework preset**: Custom
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/` (leave empty)

4. **Environment Variables**
   Add these environment variables in the Cloudflare Pages dashboard:
   ```
   VITE_API_URL=https://your-backend-url.com
   VITE_SOCKET_URL=https://your-backend-url.com
   NODE_VERSION=18
   ```

5. **Deploy**
   - Click "Save and Deploy"
   - Your site will be available at `https://your-project-name.pages.dev`

### Method 2: GitHub Actions (Automated)

The repository includes a GitHub Actions workflow that automatically deploys to Cloudflare Pages on every push to main.

**Setup:**
1. Get your Cloudflare API Token:
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create token with "Cloudflare Pages:Edit" permissions

2. Add GitHub Secrets:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
     - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

3. Push to main branch - deployment will happen automatically

## Backend Deployment Options

The backend needs to be deployed separately. Here are recommended options:

### Option 1: Cloudflare Workers (Recommended)

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Deploy the backend**:
   ```bash
   cd backend
   wrangler deploy
   ```

### Option 2: Railway

1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Select the backend folder
4. Set environment variables
5. Deploy

### Option 3: Render

1. Go to [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set build command: `cd backend && npm install && npm run build`
5. Set start command: `cd backend && npm start`

### Option 4: Heroku

1. Install Heroku CLI
2. Create a new Heroku app
3. Set buildpacks for Node.js
4. Configure environment variables
5. Deploy using Git

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=https://your-backend-url.com
VITE_SOCKET_URL=https://your-backend-url.com
```

### Backend (.env)
```
PORT=3001
JWT_SECRET=your-jwt-secret-key
DATABASE_URL=your-database-url
CORS_ORIGIN=https://your-frontend-url.pages.dev
```

## Custom Domain (Optional)

1. **In Cloudflare Pages Dashboard**:
   - Go to your project → Custom domains
   - Click "Set up a custom domain"
   - Enter your domain name

2. **DNS Configuration**:
   - Add a CNAME record pointing to your Pages URL
   - Or use Cloudflare as your DNS provider for automatic setup

## SSL/TLS

Cloudflare Pages automatically provides SSL certificates for both the default `.pages.dev` domain and custom domains.

## Troubleshooting

### Build Failures
- Check that Node.js version is set to 18
- Ensure all dependencies are listed in package.json
- Check build logs in Cloudflare Pages dashboard

### API Connection Issues
- Verify VITE_API_URL environment variable
- Check CORS settings in backend
- Ensure backend is deployed and accessible

### WebSocket Issues
- Verify VITE_SOCKET_URL environment variable
- Check that backend supports WebSocket connections
- Ensure proper proxy configuration

## Performance Optimization

1. **Enable Cloudflare optimizations**:
   - Auto Minify (CSS, HTML, JS)
   - Brotli compression
   - Image optimization

2. **Configure caching**:
   - Static assets: Cache for 1 year
   - HTML: Cache for 1 hour
   - API responses: No cache or short TTL

## Monitoring

1. **Cloudflare Analytics**: Built-in analytics in Pages dashboard
2. **Real User Monitoring**: Enable in Cloudflare dashboard
3. **Error Tracking**: Consider integrating Sentry or similar service

## Security

1. **Content Security Policy**: Configured in cloudflare-pages.toml
2. **HTTPS Only**: Enforced by default
3. **Security Headers**: Automatically applied
4. **DDoS Protection**: Included with Cloudflare

## Next Steps

After deployment:
1. Test all functionality
2. Set up monitoring and alerts
3. Configure custom domain (if desired)
4. Set up staging environment for testing
5. Configure CI/CD pipeline for automated deployments
