import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // API base URL - use same origin when served from same server
  const API_URL = process.env.REACT_APP_API_URL || window.location.origin;

  // Check session on mount and refresh
  useEffect(() => {
    checkSession();
  }, []);

  // Check if user has an active session
  const checkSession = async () => {
    try {
      // Try to get current user from /api/auth/me endpoint
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include', // CRITICAL: Include cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else if (response.status === 401) {
        // Access token expired, try to refresh
        console.log('Access token expired, attempting refresh...');
        const refreshSuccess = await refreshToken();
        
        if (refreshSuccess) {
          // Retry getting user info after refresh
          const retryResponse = await fetch(`${API_URL}/api/auth/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (retryResponse.ok) {
            const userData = await retryResponse.json();
            setUser(userData);
            return;
          }
        }
        
        // Refresh failed, clear session
        setUser(null);
        sessionStorage.removeItem('userInfo');
      } else {
        // Check sessionStorage for user info (safer than localStorage)
        const storedUserInfo = sessionStorage.getItem('userInfo');
        if (storedUserInfo) {
          setUser(JSON.parse(storedUserInfo));
        } else {
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Session check failed:', err);
      // Check sessionStorage as fallback (safer)
      const storedUserInfo = sessionStorage.getItem('userInfo');
      if (storedUserInfo) {
        setUser(JSON.parse(storedUserInfo));
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (username, password, totpToken = null) => {
    try {
      setError(null);
      
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include', // CRITICAL: Include cookies
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, totpToken })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        return { requiresTwoFactor: true };
      }

      // Set user from response (tokens are now in httpOnly cookies)
      setUser(data.user);
      
      // Only store non-sensitive user info in sessionStorage (not localStorage)
      // This is cleared when browser closes
      sessionStorage.setItem('userInfo', JSON.stringify({
        username: data.user.username,
        role: data.user.role
      }));
      
      // Navigate to dashboard
      navigate('/dashboard');
      
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // CRITICAL: Include cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Always clear user and redirect
      setUser(null);
      sessionStorage.removeItem('userInfo');
      navigate('/login');
    }
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // CRITICAL: Include cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      // Tokens are refreshed in cookies automatically
      return true;
    } catch (err) {
      console.error('Token refresh failed:', err);
      // If refresh fails, logout
      await logout();
      return false;
    }
  };

  // API request wrapper with automatic token refresh
  const apiRequest = async (url, options = {}) => {
    const makeRequest = async () => {
      const response = await fetch(`${API_URL}${url}`, {
        ...options,
        credentials: 'include', // ALWAYS include cookies
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      return response;
    };

    let response = await makeRequest();

    // If token expired, try to refresh
    if (response.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry the request
        response = await makeRequest();
      }
    }

    return response;
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Password change failed');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Enable 2FA
  const enable2FA = async () => {
    try {
      const response = await apiRequest('/api/auth/2fa/enable', {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '2FA setup failed');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Verify 2FA
  const verify2FA = async (token) => {
    try {
      const response = await apiRequest('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '2FA verification failed');
      }

      const data = await response.json();
      
      // Update user's 2FA status
      setUser(prev => ({ ...prev, twoFactorEnabled: true }));
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Auto-refresh token before expiry
  useEffect(() => {
    // Start refresh timer even if user is not set yet
    // This ensures tokens stay fresh even after page reload
    
    // Refresh token every 14 minutes (token expires in 15)
    const interval = setInterval(async () => {
      console.log('Auto-refresh timer triggered');
      const refreshed = await refreshToken();
      if (refreshed && !user) {
        // If refresh succeeded but no user is set, check session
        checkSession();
      }
    }, 14 * 60 * 1000);

    return () => clearInterval(interval);
  }, []); // Remove user dependency to always keep refreshing

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    checkSession,
    refreshToken,
    apiRequest,
    changePassword,
    enable2FA,
    verify2FA
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};