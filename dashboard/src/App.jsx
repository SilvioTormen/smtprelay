import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { motion, AnimatePresence } from 'framer-motion';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Queue from './pages/Queue';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import IPWhitelist from './pages/IPWhitelist';
import Sessions from './pages/Sessions';
import Analytics from './pages/Analytics';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: '#667eea',
            light: '#8b9cff',
            dark: '#4c63b6',
          },
          secondary: {
            main: '#764ba2',
            light: '#a374cc',
            dark: '#542f75',
          },
          success: {
            main: '#84fab0',
            light: '#b4ffd4',
            dark: '#52c77e',
          },
          error: {
            main: '#f5576c',
            light: '#ff8a95',
            dark: '#c62641',
          },
          background: {
            default: darkMode ? '#0f0f23' : '#f5f5f5',
            paper: darkMode ? '#1a1a2e' : '#ffffff',
          },
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          h1: {
            fontWeight: 700,
            fontSize: '2.5rem',
          },
          h2: {
            fontWeight: 600,
            fontSize: '2rem',
          },
          h3: {
            fontWeight: 600,
            fontSize: '1.75rem',
          },
          h4: {
            fontWeight: 600,
            fontSize: '1.5rem',
          },
          h5: {
            fontWeight: 500,
            fontSize: '1.25rem',
          },
          h6: {
            fontWeight: 500,
            fontSize: '1rem',
          },
          button: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '0.875rem',
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                backgroundImage: darkMode
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                  : 'none',
                backdropFilter: darkMode ? 'blur(10px)' : 'none',
                border: darkMode ? '1px solid rgba(255,255,255,0.1)' : 'none',
                boxShadow: darkMode
                  ? '0 8px 32px rgba(0,0,0,0.4)'
                  : '0 2px 8px rgba(0,0,0,0.1)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: darkMode
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                  : 'none',
                backdropFilter: darkMode ? 'blur(10px)' : 'none',
              },
            },
          },
        },
      }),
    [darkMode]
  );

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem('darkMode', JSON.stringify(newMode));
      return newMode;
    });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          autoHideDuration={4000}
          TransitionComponent={motion.div}
        >
          <Router>
            <AuthProvider>
              <WebSocketProvider>
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="devices" element={<Devices />} />
                      <Route path="queue" element={<Queue />} />
                      <Route path="logs" element={<Logs />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="ip-whitelist" element={<IPWhitelist />} />
                      <Route path="sessions" element={<Sessions />} />
                      <Route path="analytics" element={<Analytics />} />
                    </Route>
                  </Routes>
                </AnimatePresence>
              </WebSocketProvider>
            </AuthProvider>
          </Router>
        </SnackbarProvider>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;