import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Smartphone as SmartphoneIcon,
  Key as FidoIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import MFASetupSimple from '../components/MFASetupSimple';
import SecurityKeySetup from '../components/SecurityKeySetup';

const Profile = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [securityKeySetupOpen, setSecurityKeySetupOpen] = useState(false);
  const [backupCodesDialog, setBackupCodesDialog] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    fetchUserInfo();
    fetchMFAStatus();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const fetchMFAStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mfa/status', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setMfaStatus(data.data);
      } else {
        throw new Error('Failed to fetch MFA status');
      }
    } catch (error) {
      console.error('MFA status error:', error);
      enqueueSnackbar('Failed to load MFA status', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisableTOTP = async () => {
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch('/api/mfa/totp/disable', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        enqueueSnackbar('TOTP disabled successfully', { variant: 'success' });
        fetchMFAStatus();
      } else {
        throw new Error('Failed to disable TOTP');
      }
    } catch (error) {
      enqueueSnackbar('Failed to disable TOTP', { variant: 'error' });
    }
  };

  const handleRemoveFIDO2Device = async (deviceId) => {
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch(`/api/mfa/fido2/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        enqueueSnackbar('Device removed successfully', { variant: 'success' });
        fetchMFAStatus();
      } else {
        throw new Error('Failed to remove device');
      }
    } catch (error) {
      enqueueSnackbar('Failed to remove device', { variant: 'error' });
    }
  };

  const handleGenerateBackupCodes = async () => {
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch('/api/mfa/backup/generate', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackupCodes(data.codes);
        setBackupCodesDialog(true);
        fetchMFAStatus();
      } else {
        throw new Error('Failed to generate backup codes');
      }
    } catch (error) {
      enqueueSnackbar('Failed to generate backup codes', { variant: 'error' });
    }
  };

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      enqueueSnackbar('Passwords do not match', { variant: 'error' });
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new
        })
      });
      
      if (response.ok) {
        enqueueSnackbar('Password changed successfully', { variant: 'success' });
        setPasswordDialog(false);
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }
    } catch (error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    enqueueSnackbar('Backup codes copied to clipboard', { variant: 'success' });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Profile & Security
      </Typography>

      <Grid container spacing={3}>
        {/* User Information */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <PersonIcon sx={{ mr: 1 }} />
                <Typography variant="h6">User Information</Typography>
              </Box>
              
              <List>
                <ListItem>
                  <ListItemText 
                    primary="Username" 
                    secondary={userInfo?.username || 'N/A'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Role" 
                    secondary={
                      <Chip 
                        size="small" 
                        label={userInfo?.role || 'N/A'}
                        color={userInfo?.role === 'admin' ? 'error' : 'primary'}
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Account Created" 
                    secondary={userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : 'N/A'}
                  />
                </ListItem>
              </List>
            </CardContent>
            <CardActions>
              <Button 
                startIcon={<KeyIcon />}
                onClick={() => setPasswordDialog(true)}
                fullWidth
              >
                Change Password
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* MFA Status */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SecurityIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Two-Factor Authentication</Typography>
              </Box>

              {/* TOTP Status */}
              <Box mb={2}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center">
                    <SmartphoneIcon sx={{ mr: 1 }} />
                    <Typography>Authenticator App</Typography>
                  </Box>
                  {mfaStatus?.totp?.enabled ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip size="small" label="Enabled" color="success" icon={<CheckIcon />} />
                      <IconButton size="small" onClick={handleDisableTOTP} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button 
                      size="small" 
                      startIcon={<AddIcon />}
                      onClick={() => setMfaSetupOpen(true)}
                    >
                      Setup
                    </Button>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* FIDO2 Devices */}
              <Box mb={2}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box display="flex" alignItems="center">
                    <FidoIcon sx={{ mr: 1 }} />
                    <Typography>Security Keys</Typography>
                  </Box>
                  <Button 
                    size="small" 
                    startIcon={<AddIcon />}
                    onClick={() => setSecurityKeySetupOpen(true)}
                  >
                    Add Key
                  </Button>
                </Box>
                
                {mfaStatus?.fido2?.devices?.length > 0 ? (
                  <List dense>
                    {mfaStatus.fido2.devices.map((device) => (
                      <ListItem key={device.id}>
                        <ListItemText 
                          primary={device.name}
                          secondary={`Added: ${new Date(device.registered).toLocaleDateString()}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton 
                            edge="end" 
                            size="small"
                            onClick={() => handleRemoveFIDO2Device(device.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No security keys registered
                  </Typography>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Backup Codes */}
              <Box>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography>Backup Codes</Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {mfaStatus?.backup?.remaining > 0 && (
                      <Chip 
                        size="small" 
                        label={`${mfaStatus.backup.remaining} remaining`}
                        color={mfaStatus.backup.remaining < 3 ? 'warning' : 'default'}
                      />
                    )}
                    <Button 
                      size="small"
                      onClick={handleGenerateBackupCodes}
                      startIcon={mfaStatus?.backup?.remaining > 0 ? <RefreshIcon /> : <AddIcon />}
                    >
                      {mfaStatus?.backup?.remaining > 0 ? 'Regenerate' : 'Generate'}
                    </Button>
                  </Box>
                </Box>
                {mfaStatus?.backup?.remaining < 3 && mfaStatus?.backup?.remaining > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Low on backup codes. Generate new ones soon.
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Tips */}
        <Grid item xs={12}>
          <Alert severity="info" variant="outlined">
            <Typography variant="body2">
              <strong>Security Tips:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Enable two-factor authentication for enhanced security</li>
                <li>Use a unique, strong password for your account</li>
                <li>Keep your backup codes in a safe place</li>
                <li>Regularly review your security settings</li>
              </ul>
            </Typography>
          </Alert>
        </Grid>
      </Grid>

      {/* MFA Setup Dialog */}
      <Dialog 
        open={mfaSetupOpen} 
        onClose={() => setMfaSetupOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <MFASetupSimple onComplete={() => {
            setMfaSetupOpen(false);
            fetchMFAStatus();
          }} />
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog 
        open={backupCodesDialog} 
        onClose={() => setBackupCodesDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <WarningIcon color="warning" sx={{ mr: 1 }} />
            Backup Codes Generated
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Save these codes in a secure location. Each code can only be used once.
          </Alert>
          
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={1}>
              {backupCodes.map((code, index) => (
                <Grid item xs={6} key={index}>
                  <Typography variant="body2" fontFamily="monospace">
                    {code}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={copyBackupCodes} startIcon={<CopyIcon />}>
            Copy
          </Button>
          <Button onClick={downloadBackupCodes} startIcon={<DownloadIcon />}>
            Download
          </Button>
          <Button onClick={() => setBackupCodesDialog(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog 
        open={passwordDialog} 
        onClose={() => setPasswordDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Current Password"
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              fullWidth
            />
            <TextField
              label="New Password"
              type="password"
              value={passwords.new}
              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              fullWidth
              helperText="At least 8 characters"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              fullWidth
              error={passwords.confirm && passwords.new !== passwords.confirm}
              helperText={passwords.confirm && passwords.new !== passwords.confirm ? 'Passwords do not match' : ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialog(false)}>Cancel</Button>
          <Button 
            onClick={handlePasswordChange} 
            variant="contained"
            disabled={!passwords.current || !passwords.new || passwords.new !== passwords.confirm}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Security Key Setup Dialog */}
      <Dialog 
        open={securityKeySetupOpen} 
        onClose={() => setSecurityKeySetupOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Setup Security Keys</DialogTitle>
        <DialogContent>
          <SecurityKeySetup 
            existingDevices={mfaStatus?.fido2?.devices || []}
            onComplete={() => {
              setSecurityKeySetupOpen(false);
              fetchMFAStatus();
            }} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSecurityKeySetupOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile;