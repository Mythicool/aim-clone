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
