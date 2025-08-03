import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Smartphone as SmartphoneIcon,
  Key as KeyIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

const MFADialog = ({ open, onClose, mfaMethods, onVerify, username }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedMethod, setSelectedMethod] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Auto-select method if only one is available
    if (mfaMethods && mfaMethods.length === 1) {
      setSelectedMethod(mfaMethods[0]);
    } else if (mfaMethods && mfaMethods.includes('fido2')) {
      // Prefer FIDO2 if available
      setSelectedMethod('fido2');
    } else if (mfaMethods && mfaMethods.includes('totp')) {
      setSelectedMethod('totp');
    }
  }, [mfaMethods]);

  const handleMethodChange = (event, newMethod) => {
    if (newMethod !== null) {
      setSelectedMethod(newMethod);
      setError('');
      setTotpCode('');
    }
  };

  const handleTOTPSubmit = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onVerify('totp', totpCode);
    } catch (err) {
      setError(err.message || 'Invalid code');
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleFIDO2Auth = async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Get authentication options from server
      const beginResponse = await fetch('/api/mfa/fido2/authenticate/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }), // Pass username for authentication
      });

      if (!beginResponse.ok) {
        throw new Error('Failed to start authentication');
      }

      const { data: options } = await beginResponse.json();
      
      // Helper function to convert base64url to ArrayBuffer
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

      // Helper function to convert ArrayBuffer to base64url
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

      // Convert server options to browser format
      const publicKeyCredentialRequestOptions = {
        ...options,
        challenge: base64ToArrayBuffer(options.challenge),
        allowCredentials: options.allowCredentials?.map(cred => ({
          ...cred,
          id: base64ToArrayBuffer(cred.id),
        })),
        timeout: options.timeout || 60000,
        userVerification: options.userVerification || 'preferred',
      };

      // Step 2: Get assertion from authenticator
      enqueueSnackbar('Please interact with your security key...', { variant: 'info' });
      
      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      if (!credential) {
        throw new Error('Authentication cancelled');
      }

      // Step 3: Send credential to server
      const credentialJSON = {
        id: credential.id,
        rawId: arrayBufferToBase64(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
          authenticatorData: arrayBufferToBase64(credential.response.authenticatorData),
          signature: arrayBufferToBase64(credential.response.signature),
          userHandle: credential.response.userHandle ? 
            arrayBufferToBase64(credential.response.userHandle) : null,
        },
      };

      const completeResponse = await fetch('/api/mfa/fido2/authenticate/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credential: credentialJSON,
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const result = await completeResponse.json();
      
      // Now complete the login with FIDO2 verification
      await onVerify('fido2', result.mfaToken || 'verified');
      
      enqueueSnackbar('Security key verified successfully!', { variant: 'success' });

    } catch (error) {
      console.error('FIDO2 authentication error:', error);
      
      if (error.name === 'NotAllowedError') {
        setError('Authentication was cancelled or timed out');
      } else if (error.name === 'InvalidStateError') {
        setError('No security key registered for this account');
      } else {
        setError(error.message || 'Failed to authenticate with security key');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (selectedMethod === 'totp') {
      handleTOTPSubmit();
    } else if (selectedMethod === 'fido2') {
      handleFIDO2Auth();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && selectedMethod === 'totp') {
      handleTOTPSubmit();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => !loading && onClose()}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        Two-Factor Authentication Required
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Select your preferred authentication method:
          </Typography>
          
          {mfaMethods && mfaMethods.length > 1 && (
            <ToggleButtonGroup
              value={selectedMethod}
              exclusive
              onChange={handleMethodChange}
              fullWidth
              sx={{ mt: 2 }}
            >
              {mfaMethods.includes('totp') && (
                <ToggleButton value="totp">
                  <SmartphoneIcon sx={{ mr: 1 }} />
                  Authenticator App
                </ToggleButton>
              )}
              {mfaMethods.includes('fido2') && (
                <ToggleButton value="fido2">
                  <KeyIcon sx={{ mr: 1 }} />
                  Security Key
                </ToggleButton>
              )}
            </ToggleButtonGroup>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {selectedMethod === 'totp' && (
          <Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Enter the 6-digit code from your authenticator app:
            </Typography>
            <TextField
              fullWidth
              label="6-Digit Code"
              value={totpCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 6) {
                  setTotpCode(value);
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder="000000"
              autoFocus
              disabled={loading}
              inputProps={{
                maxLength: 6,
                pattern: '[0-9]*',
                inputMode: 'numeric',
                style: { 
                  letterSpacing: '0.5em',
                  fontSize: '1.5rem',
                  textAlign: 'center'
                }
              }}
              sx={{ mt: 2 }}
            />
          </Box>
        )}

        {selectedMethod === 'fido2' && (
          <Box textAlign="center" sx={{ py: 2 }}>
            <KeyIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="body1" gutterBottom>
              {loading ? 'Waiting for security key...' : 'Click verify to authenticate with your security key'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Insert your security key and follow the browser prompts
            </Typography>
            {loading && (
              <CircularProgress sx={{ mt: 2 }} />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={
            loading || 
            !selectedMethod ||
            (selectedMethod === 'totp' && (!totpCode || totpCode.length !== 6))
          }
        >
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MFADialog;