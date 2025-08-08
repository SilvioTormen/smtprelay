// API utility with CSRF token handling

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let csrfToken = null;

// Fetch CSRF token
export const fetchCSRFToken = async () => {
  try {
    const response = await fetch(`${API_URL}/auth/csrf-token`, {
      credentials: 'include'
    });
    const data = await response.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
};

// API request wrapper with CSRF token
export const apiRequest = async (url, options = {}) => {
  // Ensure we have a CSRF token for non-GET requests
  if (options.method && options.method !== 'GET' && !csrfToken) {
    await fetchCSRFToken();
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add CSRF token for non-GET requests
  if (options.method && options.method !== 'GET' && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  // If CSRF token is invalid, retry once with new token
  if (response.status === 403 && options.method !== 'GET') {
    await fetchCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      return fetch(`${API_URL}${url}`, {
        ...options,
        headers,
        credentials: 'include'
      });
    }
  }

  return response;
};

export default apiRequest;