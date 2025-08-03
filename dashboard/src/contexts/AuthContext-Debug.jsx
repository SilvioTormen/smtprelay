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

  // API base URL
  const API_URL = process.env.REACT_APP_API_URL || window.location.origin;

  // Check session on mount
  useEffect(() => {
    console.log('[AuthContext] Checking session on mount...');
    checkSession();
  }, []);

  // Debug user state changes
  useEffect(() => {
    console.log('[AuthContext] User state changed:', user);
  }, [user]);

  // Check if user has an active session
  const checkSession = async () => {
    console.log('[AuthContext] checkSession called');
    try {
      // First check sessionStorage
      const storedUserInfo = sessionStorage.getItem('userInfo');
      if (storedUserInfo) {
        console.log('[AuthContext] Found user in sessionStorage:', storedUserInfo);
        const userInfo = JSON.parse(storedUserInfo);
        setUser(userInfo);
        setLoading(false);
        return;
      }

      // Then try API
      console.log('[AuthContext] Checking API /api/auth/me...');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('[AuthContext] API response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('[AuthContext] Got user from API:', userData);
        setUser(userData);
        // Store in sessionStorage
        sessionStorage.setItem('userInfo', JSON.stringify(userData));
      } else {
        console.log('[AuthContext] API returned non-OK status');
        setUser(null);
      }
    } catch (err) {
      console.error('[AuthContext] Session check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (username, password, totpToken = null) => {
    console.log('[AuthContext] Login attempt for:', username);
    try {
      setError(null);
      
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, totpToken })
      });

      const data = await response.json();
      console.log('[AuthContext] Login response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        return { requiresTwoFactor: true };
      }

      // Set user from response
      setUser(data.user);
      
      // Store in sessionStorage for persistence
      sessionStorage.setItem('userInfo', JSON.stringify(data.user));
      
      // Store token if provided
      if (data.token) {
        sessionStorage.setItem('authToken', data.token);
        console.log('[AuthContext] Token stored');
      }
      
      console.log('[AuthContext] Login successful, user set:', data.user);
      
      // Navigate to dashboard
      navigate('/dashboard');
      
      return { success: true };
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Logout function
  const logout = async () => {
    console.log('[AuthContext] Logout called');
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    } finally {
      // Always clear user and redirect
      setUser(null);
      sessionStorage.clear();
      navigate('/login');
    }
  };

  // API Request helper with authentication
  const apiRequest = async (url, options = {}) => {
    console.log('[AuthContext] API Request to:', url);
    
    // Get token from sessionStorage
    const token = sessionStorage.getItem('authToken');
    
    const requestOptions = {
      ...options,
      credentials: 'include', // Always include cookies
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }), // Add token if available
        ...options.headers
      }
    };

    try {
      const response = await fetch(`${API_URL}${url}`, requestOptions);
      
      if (response.status === 401) {
        console.log('[AuthContext] 401 Unauthorized, redirecting to login');
        sessionStorage.clear();
        setUser(null);
        navigate('/login');
      }
      
      return response;
    } catch (error) {
      console.error('[AuthContext] API Request error:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    checkSession,
    apiRequest
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;