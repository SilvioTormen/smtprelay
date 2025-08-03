import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Step,
  StepLabel,
  Stepper,
  Grid
} from '@mui/material';
import { QrCode2, ContentCopy, CheckCircle } from '@mui/icons-material';
import QRCode from 'react-qr-code';
import { useSnackbar } from 'notistack';

const MFASetupSimple = ({ onComplete }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [totpData, setTotpData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);

  const steps = ['Generate QR Code', 'Scan with App', 'Verify Setup'];

  const generateTOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mfa/totp/setup', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTotpData(data.data);
        setActiveStep(1);
      } else {
        throw new Error('Failed to generate TOTP');
      }
    } catch (error) {
      enqueueSnackbar('Failed to setup authenticator', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const verifyTOTP = async () => {
    if (verificationCode.length !== 6) {
      enqueueSnackbar('Please enter a 6-digit code', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/mfa/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: verificationCode })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.backupCodes) {
          setBackupCodes(data.backupCodes);
        }
        setActiveStep(2);
        enqueueSnackbar('Authenticator app enabled successfully!', { variant: 'success' });
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Invalid code');
      }
    } catch (error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'success' });
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

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <Box textAlign="center">
          <Typography variant="h6" gutterBottom>
            Setup Authenticator App
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Use Microsoft Authenticator, Google Authenticator, or any compatible TOTP app
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={generateTOTP}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <QrCode2 />}
          >
            {loading ? 'Generating...' : 'Generate QR Code'}
          </Button>
        </Box>
      )}

      {activeStep === 1 && totpData && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Scan QR Code
              </Typography>
              <Box sx={{ my: 3, bgcolor: 'white', p: 2, borderRadius: 1 }}>
                <QRCode value={totpData.uri} size={200} />
              </Box>
              <Typography variant="caption" color="textSecondary">
                Scan this QR code with your authenticator app
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Manual Entry
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Can't scan? Enter this key manually:
              </Alert>
              
              <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 2 }}>
                <Typography 
                  variant="body2" 
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                >
                  {totpData.manualEntryKey}
                </Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopy />}
                  onClick={() => copyToClipboard(totpData.secret)}
                  sx={{ mt: 1 }}
                >
                  Copy
                </Button>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Enter Verification Code
              </Typography>
              <TextField
                fullWidth
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ 
                  maxLength: 6,
                  style: { fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }
                }}
                sx={{ mb: 2 }}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={verifyTOTP}
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? <CircularProgress size={24} /> : 'Verify & Enable'}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeStep === 2 && (
        <Box textAlign="center">
          <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Setup Complete!
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Your authenticator app has been successfully configured.
          </Typography>
          
          {backupCodes.length > 0 && (
            <Paper sx={{ p: 3, mt: 3, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
              <Typography variant="h6" gutterBottom>
                Backup Codes
              </Typography>
              <Typography variant="body2" paragraph>
                Save these codes in a safe place. Each can be used once if you lose access to your authenticator.
              </Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {backupCodes.map((code, index) => (
                  <Grid item xs={6} key={index}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {code}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
              <Button
                variant="contained"
                size="small"
                onClick={downloadBackupCodes}
                sx={{ bgcolor: 'warning.dark' }}
              >
                Download Codes
              </Button>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MFASetupSimple;