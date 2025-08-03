import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  LockOutlined,
  EmailOutlined,
  ShieldOutlined,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext-Debug'; // Use debug version
import MFADialog from '../components/MFADialog';

const Login = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaMethods, setMfaMethods] = useState([]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rememberMe' ? checked : value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await login(
        formData.username,
        formData.password
      );

      if (response.requiresTwoFactor) {
        // Show MFA dialog
        setMfaMethods(response.mfaMethods || []);
        setMfaDialogOpen(true);
        setLoading(false);
      } else if (response.success) {
        enqueueSnackbar('Login successful! Welcome back.', { variant: 'success' });
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      enqueueSnackbar(err.message || 'Login failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (method, code) => {
    setLoading(true);
    try {
      const response = await login(
        formData.username,
        formData.password,
        method === 'totp' ? code : undefined,
        method === 'fido2' ? { fido2Verified: true } : undefined
      );

      if (response.success) {
        setMfaDialogOpen(false);
        enqueueSnackbar('Login successful! Welcome back.', { variant: 'success' });
        navigate('/dashboard');
      }
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: (theme) => theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card
          sx={{
            width: { xs: '100%', sm: 400 },
            p: 4,
            WebkitBackdropFilter: 'blur(10px)',
            backdropFilter: 'blur(10px)',
            backgroundColor: 'background.paper',
            boxShadow: 3,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block' }}
            >
              <ShieldOutlined
                sx={{
                  fontSize: 48,
                  color: 'primary.main',
                  mb: 2,
                }}
              />
            </motion.div>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              SMTP Relay
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Control Center Login
            </Typography>
          </Box>

          <form onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              id="username"
              name="username"
              label="Username"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              required
              autoFocus
              autoComplete="username"
              aria-label="Username"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined color="action" />
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: 'background.paper',
                  '& input': {
                    color: 'text.primary',
                  }
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                }
              }}
              disabled={loading}
            />

            <TextField
              fullWidth
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="current-password"
              aria-label="Password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: 'background.paper',
                  '& input': {
                    color: 'text.primary',
                  }
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                }
              }}
              disabled={loading}
            />


            <FormControlLabel
              control={
                <Checkbox
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  color="primary"
                />
              }
              label="Remember me"
              sx={{ mt: 1, mb: 2 }}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              </motion.div>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                mt: 2,
                mb: 2,
                height: 48,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>

            <Divider sx={{ my: 2 }}>
              <Typography variant="caption" color="text.secondary">
                SECURITY INFO
              </Typography>
            </Divider>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                This is a secure system. Unauthorized access is prohibited.
                All activities are monitored and logged.
              </Typography>
            </Box>
          </form>
        </Card>
      </motion.div>

      <MFADialog
        open={mfaDialogOpen}
        onClose={() => setMfaDialogOpen(false)}
        mfaMethods={mfaMethods}
        onVerify={handleMFAVerify}
        username={formData.username}
      />
    </Box>
  );
};

export default Login;