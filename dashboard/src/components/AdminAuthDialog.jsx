import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import {
  Security as SecurityIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';

const AdminAuthDialog = ({ open, onClose, tenantId, onAuthComplete }) => {
  const { apiRequest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && tenantId && !deviceCode) {
      initializeAdminAuth();
    }
  }, [open, tenantId]);

  useEffect(() => {
    let pollInterval;
    if (polling && deviceCode) {
      pollInterval = setInterval(pollForAuth, 5000);
    }
    return () => clearInterval(pollInterval);
  }, [polling, deviceCode]);

  const initializeAdminAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/azure-graph/admin/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });

      const data = await response.json();
      
      if (response.ok && (data.success || data.userCode)) {
        setDeviceCode(data);
        setPolling(true);
        
        // Don't automatically open - let user click the button
      } else {
        setError(data.error || 'Failed to initialize admin authentication');
      }
    } catch (err) {
      setError('Failed to start authentication process');
    } finally {
      setLoading(false);
    }
  };

  const pollForAuth = async () => {
    try {
      const response = await apiRequest('/api/azure-graph/admin/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          flowId: deviceCode.flowId 
        })
      });

      const data = await response.json();
      
      if (data.authenticated) {
        setPolling(false);
        onAuthComplete(true);
        onClose();
      } else if (data.error && data.error !== 'authorization_pending') {
        setPolling(false);
        setError(data.error);
      }
    } catch (err) {
      // Continue polling
    }
  };

  const copyCode = () => {
    if (deviceCode?.userCode) {
      navigator.clipboard.writeText(deviceCode.userCode);
    }
  };

  return (
    <Dialog open={open} onClose={!polling ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <SecurityIcon sx={{ mr: 1 }} />
          Administrator Authentication Required
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading && !deviceCode ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : deviceCode ? (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>Sign in as Azure AD Administrator</AlertTitle>
              To delete the application from Azure AD, you need to authenticate with administrator privileges.
            </Alert>

            <Typography variant="body1" gutterBottom>
              Please use this code to authenticate:
            </Typography>

            <Card sx={{ my: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              <CardContent>
                <Typography variant="h3" align="center" gutterBottom>
                  {deviceCode.userCode}
                </Typography>
                <Box display="flex" justifyContent="center" mt={2}>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<CopyIcon />}
                    onClick={copyCode}
                  >
                    Copy Code
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              Click the button below to open the authentication page:
            </Typography>

            <Button
              variant="contained"
              fullWidth
              startIcon={<OpenIcon />}
              onClick={() => window.open(deviceCode.verificationUrl, '_blank')}
              sx={{ mb: 2 }}
            >
              Open Microsoft Login
            </Button>

            {polling && (
              <Box display="flex" alignItems="center" justifyContent="center" mt={2}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Waiting for authentication...
                </Typography>
              </Box>
            )}

            <Alert severity="warning" sx={{ mt: 2 }}>
              <strong>Important:</strong> Sign in with an account that has Global Administrator or Application Administrator privileges in your Azure AD tenant.
            </Alert>
          </Box>
        ) : error ? (
          <Alert severity="error">
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={polling}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdminAuthDialog;