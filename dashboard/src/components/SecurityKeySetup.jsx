import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Key as KeyIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Fingerprint as FingerprintIcon,
  UsbRounded as UsbIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

const SecurityKeySetup = ({ onComplete, existingDevices = [] }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [devices, setDevices] = useState(existingDevices);
  const [deleteDialog, setDeleteDialog] = useState(null);

  const steps = ['Name Your Key', 'Insert Security Key', 'Verify Registration'];

  // Check if WebAuthn is supported
  const isWebAuthnSupported = () => {
    return window.PublicKeyCredential !== undefined;
  };

  const handleRegisterKey = async () => {
    if (!deviceName.trim()) {
      enqueueSnackbar('Please enter a name for your security key', { variant: 'warning' });
      return;
    }

    if (!isWebAuthnSupported()) {
      enqueueSnackbar('WebAuthn is not supported in this browser', { variant: 'error' });
      return;
    }

    setLoading(true);
    setActiveStep(1);

    try {
      // Step 1: Get registration options from server
      const beginResponse = await fetch('/api/mfa/fido2/register/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!beginResponse.ok) {
        throw new Error('Failed to start registration');
      }

      const { data: options } = await beginResponse.json();
      
      console.log('Received options from server:', options);
      
      // Convert server options to browser format
      // Handle both string and object formats for user.id
      let userId;
      if (typeof options.user.id === 'string') {
        userId = base64ToArrayBuffer(options.user.id);
      } else if (options.user.id instanceof Object && options.user.id.type === 'Buffer') {
        // Handle Buffer object from Node.js
        userId = new Uint8Array(options.user.id.data).buffer;
      } else {
        // Already in correct format
        userId = options.user.id;
      }
      
      const publicKeyCredentialCreationOptions = {
        ...options,
        challenge: base64ToArrayBuffer(options.challenge),
        user: {
          ...options.user,
          id: userId,
        },
        pubKeyCredParams: options.pubKeyCredParams || [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: options.authenticatorSelection || {
          authenticatorAttachment: 'cross-platform',
          userVerification: 'preferred',
          requireResidentKey: false,
        },
        attestation: options.attestation || 'direct',
        timeout: options.timeout || 60000,
      };

      // Step 2: Create credential with authenticator
      setActiveStep(2);
      enqueueSnackbar('Please interact with your security key...', { variant: 'info' });
      
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Step 3: Send credential to server
      const credentialJSON = {
        id: credential.id,
        rawId: arrayBufferToBase64(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
          attestationObject: arrayBufferToBase64(credential.response.attestationObject),
        },
      };

      const completeResponse = await fetch('/api/mfa/fido2/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credential: credentialJSON,
          deviceName: deviceName.trim(),
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error || 'Failed to complete registration');
      }

      const result = await completeResponse.json();
      
      // Add new device to list
      const newDevice = {
        id: result.credentialID,
        name: deviceName.trim(),
        registered: new Date().toISOString(),
        lastUsed: null,
      };
      
      setDevices([...devices, newDevice]);
      setActiveStep(3);
      
      enqueueSnackbar('Security key registered successfully!', { variant: 'success' });
      
      // Reset form
      setTimeout(() => {
        setActiveStep(0);
        setDeviceName('');
        if (onComplete) {
          onComplete(newDevice);
        }
      }, 2000);

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.name === 'NotAllowedError') {
        enqueueSnackbar('Registration was cancelled or timed out', { variant: 'warning' });
      } else if (error.name === 'InvalidStateError') {
        enqueueSnackbar('This key may already be registered', { variant: 'warning' });
      } else {
        enqueueSnackbar(error.message || 'Failed to register security key', { variant: 'error' });
      }
      
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    try {
      const response = await fetch(`/api/mfa/fido2/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to remove device');
      }

      setDevices(devices.filter(d => d.id !== deviceId));
      enqueueSnackbar('Security key removed successfully', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to remove security key', { variant: 'error' });
    } finally {
      setDeleteDialog(null);
    }
  };

  // Helper functions for base64url encoding/decoding (WebAuthn uses base64url, not base64)
  const base64ToArrayBuffer = (base64url) => {
    // Convert base64url to base64
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if necessary
    const padding = (4 - (base64.length % 4)) % 4;
    if (padding) {
      base64 += '='.repeat(padding);
    }
    
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // Convert to base64url (no padding, replace + and /)
    return window.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  if (!isWebAuthnSupported()) {
    return (
      <Alert severity="warning">
        Your browser doesn't support WebAuthn/Security Keys. 
        Please use a modern browser like Chrome, Firefox, Safari, or Edge.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Existing Devices */}
      {devices.length > 0 && (
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Registered Security Keys
          </Typography>
          <List>
            {devices.map((device) => (
              <ListItem key={device.id}>
                <KeyIcon sx={{ mr: 2 }} />
                <ListItemText
                  primary={device.name}
                  secondary={`Registered: ${new Date(device.registered).toLocaleDateString()}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => setDeleteDialog(device)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Registration Stepper */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add New Security Key
        </Typography>
        
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box>
          {activeStep === 0 && (
            <Box>
              <Typography variant="body2" color="textSecondary" paragraph>
                Give your security key a name to identify it later.
              </Typography>
              <TextField
                fullWidth
                label="Security Key Name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g., YubiKey 5C, Work Key, etc."
                disabled={loading}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={<KeyIcon />}
                onClick={handleRegisterKey}
                disabled={loading || !deviceName.trim()}
                fullWidth
              >
                Start Registration
              </Button>
            </Box>
          )}

          {activeStep === 1 && (
            <Box textAlign="center">
              <UsbIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Insert Your Security Key
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Please insert your security key into a USB port or hold it near the NFC reader.
              </Typography>
              <CircularProgress />
            </Box>
          )}

          {activeStep === 2 && (
            <Box textAlign="center">
              <FingerprintIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Verify Your Identity
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Touch your security key or use your biometric verification when prompted.
              </Typography>
              <CircularProgress />
            </Box>
          )}

          {activeStep === 3 && (
            <Box textAlign="center">
              <SecurityIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="success.main" gutterBottom>
                Registration Successful!
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Your security key has been registered successfully.
              </Typography>
            </Box>
          )}
        </Box>

        {/* Supported Devices Info */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Supported devices:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>YubiKey (all models)</li>
              <li>Windows Hello (fingerprint, face, PIN)</li>
              <li>Touch ID / Face ID (macOS, iOS)</li>
              <li>Android biometrics</li>
              <li>Other FIDO2-compatible security keys</li>
            </ul>
          </Typography>
        </Alert>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteDialog)}
        onClose={() => setDeleteDialog(null)}
      >
        <DialogTitle>Remove Security Key</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove "{deleteDialog?.name}"?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            You won't be able to use this key for authentication anymore.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button
            onClick={() => handleDeleteDevice(deleteDialog.id)}
            color="error"
            variant="contained"
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecurityKeySetup;