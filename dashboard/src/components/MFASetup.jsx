import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondary,
  IconButton,
  Chip,
  Paper,
  Grid,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  PhoneAndroid,
  Key,
  Security,
  QrCode2,
  ContentCopy,
  Delete,
  Edit,
  CheckCircle,
  Warning,
  Add,
  Refresh,
  Download,
} from '@mui/icons-material';
import QRCode from 'react-qr-code';
import { useSnackbar } from 'notistack';
import { motion, AnimatePresence } from 'framer-motion';
import * as SimpleWebAuthnBrowser from '@simplewebauthn/browser';
import axios from 'axios';

const MFASetup = ({ open, onClose, user }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mfaStatus, setMFAStatus] = useState(null);
  
  // TOTP State
  const [totpStep, setTotpStep] = useState(0);
  const [totpData, setTotpData] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  
  // FIDO2 State
  const [fido2Devices, setFido2Devices] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  
  // Backup Codes State
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMFAStatus();
    }
  }, [open]);

  const fetchMFAStatus = async () => {
    try {
      const response = await axios.get('/api/mfa/status');
      setMFAStatus(response.data.data);
      setFido2Devices(response.data.data.fido2.devices || []);
    } catch (error) {
      enqueueSnackbar('Failed to fetch MFA status', { variant: 'error' });
    }
  };

  // TOTP Setup
  const startTOTPSetup = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/mfa/totp/setup');
      setTotpData(response.data.data);
      setTotpStep(1);
      enqueueSnackbar('Scan the QR code with Microsoft Authenticator', { variant: 'info' });
    } catch (error) {
      enqueueSnackbar('Failed to setup TOTP', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const verifyTOTP = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/mfa/totp/verify', {
        token: totpCode,
      });
      
      if (response.data.backupCodes) {
        setBackupCodes(response.data.backupCodes);
        setShowBackupCodes(true);
      }
      
      enqueueSnackbar('Microsoft Authenticator enabled successfully!', { variant: 'success' });
      setTotpStep(2);
      fetchMFAStatus();
    } catch (error) {
      enqueueSnackbar('Invalid code. Please try again.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // FIDO2/WebAuthn Setup
  const registerFIDO2Device = async () => {
    setRegistering(true);
    try {
      // Step 1: Get registration options from server
      const optionsResponse = await axios.post('/api/mfa/fido2/register/begin');
      const options = optionsResponse.data.data;

      // Step 2: Create credential with browser/YubiKey
      const credential = await SimpleWebAuthnBrowser.startRegistration(options);

      // Step 3: Send credential to server for verification
      const verifyResponse = await axios.post('/api/mfa/fido2/register/complete', {
        credential,
        deviceName: deviceName || `YubiKey ${fido2Devices.length + 1}`,
      });

      if (verifyResponse.data.backupCodes) {
        setBackupCodes(verifyResponse.data.backupCodes);
        setShowBackupCodes(true);
      }

      enqueueSnackbar('Security key registered successfully!', { variant: 'success' });
      fetchMFAStatus();
      setDeviceName('');
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        enqueueSnackbar('Registration was cancelled or timed out', { variant: 'warning' });
      } else {
        enqueueSnackbar('Failed to register security key', { variant: 'error' });
      }
      console.error('FIDO2 registration error:', error);
    } finally {
      setRegistering(false);
    }
  };

  const removeFIDO2Device = async (deviceId) => {
    try {
      await axios.delete(`/api/mfa/fido2/devices/${deviceId}`);
      enqueueSnackbar('Device removed successfully', { variant: 'success' });
      fetchMFAStatus();
    } catch (error) {
      enqueueSnackbar('Failed to remove device', { variant: 'error' });
    }
  };

  // Backup Codes
  const generateNewBackupCodes = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/mfa/backup/generate');
      setBackupCodes(response.data.data.codes);
      setShowBackupCodes(true);
      enqueueSnackbar('New backup codes generated', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to generate backup codes', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `SMTP Relay Backup Codes
Generated: ${new Date().toISOString()}
User: ${user?.username}

IMPORTANT: Keep these codes safe! Each code can only be used once.

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

Store these codes in a secure location.`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smtp-relay-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'info' });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%)',
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Security color="primary" />
          <Typography variant="h5">Multi-Factor Authentication Setup</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
          <Tab 
            label="Microsoft Authenticator" 
            icon={<PhoneAndroid />} 
            iconPosition="start"
          />
          <Tab 
            label="Security Key (YubiKey)" 
            icon={<Key />} 
            iconPosition="start"
          />
          <Tab 
            label="Backup Codes" 
            icon={<Security />} 
            iconPosition="start"
          />
        </Tabs>

        <AnimatePresence mode="wait">
          {/* TOTP Tab */}
          {activeTab === 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {mfaStatus?.totp?.enabled ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Microsoft Authenticator is enabled for your account
                </Alert>
              ) : (
                <Box>
                  <Stepper activeStep={totpStep} sx={{ mb: 3 }}>
                    <Step>
                      <StepLabel>Setup</StepLabel>
                    </Step>
                    <Step>
                      <StepLabel>Verify</StepLabel>
                    </Step>
                    <Step>
                      <StepLabel>Complete</StepLabel>
                    </Step>
                  </Stepper>

                  {totpStep === 0 && (
                    <Box textAlign="center">
                      <Typography variant="h6" gutterBottom>
                        Setup Microsoft Authenticator
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Use Microsoft Authenticator, Google Authenticator, or any compatible TOTP app
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<QrCode2 />}
                        onClick={startTOTPSetup}
                        disabled={loading}
                      >
                        {loading ? <CircularProgress size={24} /> : 'Start Setup'}
                      </Button>
                    </Box>
                  )}

                  {totpStep === 1 && totpData && (
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Scan QR Code
                          </Typography>
                          <Box sx={{ p: 2, background: 'white' }}>
                            <QRCode
                              value={totpData.uri}
                              size={200}
                              level="H"
                            />
                          </Box>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Or enter manually:
                        </Typography>
                        <Paper sx={{ p: 2, mb: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Account Name:
                          </Typography>
                          <Typography variant="body2" fontFamily="monospace">
                            SMTP Relay ({user?.username})
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2, mb: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Secret Key:
                          </Typography>
                          <Box display="flex" alignItems="center">
                            <Typography variant="body2" fontFamily="monospace">
                              {totpData.manualEntryKey}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(totpData.secret)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Box>
                        </Paper>
                        
                        <TextField
                          fullWidth
                          label="Enter 6-digit code"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          inputProps={{ maxLength: 6 }}
                          sx={{ mb: 2 }}
                        />
                        
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={verifyTOTP}
                          disabled={loading || totpCode.length !== 6}
                        >
                          Verify Code
                        </Button>
                      </Grid>
                    </Grid>
                  )}

                  {totpStep === 2 && (
                    <Box textAlign="center">
                      <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Setup Complete!
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Microsoft Authenticator has been successfully enabled
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </motion.div>
          )}

          {/* FIDO2/YubiKey Tab */}
          {activeTab === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Security keys like YubiKey provide the strongest authentication
                </Alert>

                <List>
                  {fido2Devices.map((device) => (
                    <ListItem
                      key={device.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={() => removeFIDO2Device(device.id)}
                        >
                          <Delete />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        <Key />
                      </ListItemIcon>
                      <ListItemText
                        primary={device.name}
                        secondary={`Registered: ${new Date(device.registered).toLocaleDateString()}`}
                      />
                      {device.lastUsed && (
                        <Chip
                          label={`Last used: ${new Date(device.lastUsed).toLocaleDateString()}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </ListItem>
                  ))}
                </List>

                <Divider sx={{ my: 2 }} />

                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Add New Security Key
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={8}>
                      <TextField
                        fullWidth
                        label="Device Name (optional)"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        placeholder="e.g., YubiKey 5C"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Add />}
                        onClick={registerFIDO2Device}
                        disabled={registering}
                      >
                        {registering ? <CircularProgress size={24} /> : 'Add Key'}
                      </Button>
                    </Grid>
                  </Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Insert your YubiKey and follow the browser prompts
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          )}

          {/* Backup Codes Tab */}
          {activeTab === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Backup codes can be used to access your account if you lose your authenticator
                </Alert>

                {mfaStatus?.backup?.remaining !== undefined && (
                  <Paper sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle1">
                      Remaining Codes: {mfaStatus.backup.remaining}
                    </Typography>
                    {mfaStatus.backup.remaining <= 3 && (
                      <Typography variant="body2" color="error">
                        Low on backup codes! Generate new ones soon.
                      </Typography>
                    )}
                  </Paper>
                )}

                {showBackupCodes && backupCodes.length > 0 && (
                  <Paper sx={{ p: 2, mb: 2, background: '#fffbf0' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Your Backup Codes
                    </Typography>
                    <Grid container spacing={1}>
                      {backupCodes.map((code, index) => (
                        <Grid item xs={6} sm={4} key={index}>
                          <Paper sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="body2" fontFamily="monospace">
                              {code}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        startIcon={<Download />}
                        onClick={downloadBackupCodes}
                        size="small"
                      >
                        Download
                      </Button>
                      <Button
                        startIcon={<ContentCopy />}
                        onClick={() => copyToClipboard(backupCodes.join('\n'))}
                        size="small"
                      >
                        Copy All
                      </Button>
                    </Box>
                  </Paper>
                )}

                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={generateNewBackupCodes}
                  disabled={loading}
                  fullWidth
                >
                  Generate New Backup Codes
                </Button>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MFASetup;