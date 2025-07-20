/**
 * API utility functions for making HTTP requests
 */

// Get the API base URL from environment variables
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
