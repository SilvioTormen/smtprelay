import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  AlertTitle,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  Tooltip,
  Chip,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Container,
  InputAdornment,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext-Debug';
import SimpleAzureSetup from '../components/SimpleAzureSetup';
import ManualAzureSetup from '../components/ManualAzureSetup';
import AzureAdminSetup from '../components/AzureAdminSetup';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  AccountCircle as AccountIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Add as AddIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  History as HistoryIcon,
  Build as BuildIcon,
  AdminPanelSettings as AdminIcon,
  Send as SendIcon
} from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const ExchangeSetup = () => {
  const { apiRequest } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [config, setConfig] = useState({
    authMethod: 'device_code',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    apiMethod: 'graph_api',
    sendAs: ''
  });
  const [deviceCodeInfo, setDeviceCodeInfo] = useState(null);
  const [polling, setPolling] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [setupMode, setSetupMode] = useState('choose'); // 'choose', 'automatic', 'manual'

  const steps = ['Choose Method', 'Configure Azure AD', 'Authenticate', 'Test Connection'];

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    let pollInterval;
    if (polling && deviceCodeInfo) {
      pollInterval = setInterval(() => {
        pollForToken();
      }, (deviceCodeInfo.interval || 5) * 1000);
    }
    return () => clearInterval(pollInterval);
  }, [polling, deviceCodeInfo]);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/exchange-config/status');
      const data = await response.json();
      setStatus(data);
      setAccounts(data.accounts || []);
      
      // Only show wizard if not configured
      if (!data.isConfigured) {
        setShowSetupWizard(true);
      }
    } catch (err) {
      console.error('Failed to check status:', err);
      setShowSetupWizard(true);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setDeviceCodeInfo(null);
    setPolling(false);
    setTestResult(null);
    setError(null);
    setSuccess(null);
  };

  const startAuthentication = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('/api/exchange-config/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'new' })
      });
      
      const data = await response.json();
      setDeviceCodeInfo(data);
      setPolling(true);
      handleNext();
    } catch (err) {
      setError('Failed to start authentication');
    } finally {
      setLoading(false);
    }
  };

  const pollForToken = async () => {
    try {
      const response = await apiRequest('/api/exchange-config/auth/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deviceCode: deviceCodeInfo.device_code,
          interval: deviceCodeInfo.interval 
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setPolling(false);
        setSuccess('Authentication successful!');
        await checkStatus();
        handleNext();
      }
    } catch (err) {
      if (!err.message?.includes('authorization_pending')) {
        setError('Authentication failed');
        setPolling(false);
      }
    }
  };

  const saveConfiguration = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('/api/exchange-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        setSuccess('Configuration saved successfully');
        await checkStatus();
        
        if (config.authMethod === 'device_code') {
          await startAuthentication();
        } else {
          handleNext();
        }
      }
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (accountId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('/api/exchange-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });
      
      const data = await response.json();
      setTestResult(data);
      if (data.success) {
        setSuccess('Connection test successful!');
      } else {
        setError(data.error || 'Connection test failed');
      }
    } catch (err) {
      setError('Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const refreshAccountTokens = async (accountId) => {
    setLoading(true);
    try {
      await apiRequest(`/api/exchange-config/accounts/${accountId}/refresh`, {
        method: 'POST'
      });
      setSuccess('Token refreshed successfully');
      await checkStatus();
    } catch (err) {
      setError('Failed to refresh token');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultAccount = async (accountId) => {
    try {
      await apiRequest(`/api/exchange-config/accounts/${accountId}/set-default`, {
        method: 'POST'
      });
      await checkStatus();
    } catch (err) {
      setError('Failed to set default account');
    }
  };

  const deleteAccount = async (accountId) => {
    try {
      await apiRequest(`/api/exchange-config/accounts/${accountId}`, {
        method: 'DELETE'
      });
      await checkStatus();
    } catch (err) {
      setError('Failed to delete account');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getTimeUntilExpiry = (expiryDate) => {
    if (!expiryDate) return 'Expired';
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days ${hours} hours`;
    return `${hours} hours`;
  };

  const handleAutomaticSetupComplete = async (result) => {
    if (result.success) {
      setSuccess('Azure AD application created successfully!');
      await checkStatus();
      setShowSetupWizard(false);
    }
  };

  if (loading && !status) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" height="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Main Status Overview - Show when configured
  if (status?.isConfigured && !showSetupWizard) {
    return (
      <Container maxWidth="lg">
        <Paper sx={{ p: 4, mt: 3 }}>
          {/* Header with Status */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Box display="flex" alignItems="center">
              <CheckCircleIcon color="success" sx={{ fontSize: 48, mr: 2 }} />
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  Exchange Online Configuration
                </Typography>
                <Typography variant="body1" color="textSecondary">
                  System is configured and ready • Last checked: {new Date().toLocaleTimeString()}
                </Typography>
              </Box>
            </Box>
            <Box>
              <Button
                startIcon={<RefreshIcon />}
                onClick={checkStatus}
                sx={{ mr: 1 }}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<BuildIcon />}
                onClick={() => setShowSetupWizard(true)}
              >
                Reconfigure
              </Button>
            </Box>
          </Box>

          {/* Configuration Overview Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <CloudIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                    <Typography variant="h6">Azure AD Application</Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Tenant ID" 
                        secondary={
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {status.tenantId || 'Not configured'}
                          </Typography>
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Client ID" 
                        secondary={
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {status.clientId || 'Not configured'}
                          </Typography>
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Authentication" 
                        secondary={
                          <Chip 
                            label={status.authMethod === 'device_code' ? 'Device Code Flow' : 'Client Credentials'}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        }
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <EmailIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                    <Typography variant="h6">Email Configuration</Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="API Method" 
                        secondary={
                          <Chip 
                            label={status.apiMethod === 'graph_api' ? 'Microsoft Graph' : 'SMTP OAuth'}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="SMTP Server" 
                        secondary="smtp.office365.com:587"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Security" 
                        secondary="STARTTLS / OAuth 2.0"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <AccountIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                    <Typography variant="h6">Authentication Status</Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Active Accounts" 
                        secondary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2">
                              {accounts.filter(a => a.hasValidToken).length} of {accounts.length} authenticated
                            </Typography>
                            {accounts.filter(a => a.hasValidToken).length === accounts.length && accounts.length > 0 && (
                              <CheckCircleIcon color="success" fontSize="small" />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Default Account" 
                        secondary={status.defaultAccount || 'None selected'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Token Status" 
                        secondary={
                          accounts.some(a => a.hasValidToken) 
                            ? `Valid until ${new Date(accounts.find(a => a.hasValidToken)?.tokenExpiresAt).toLocaleDateString()}`
                            : 'No valid tokens'
                        }
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Quick Actions */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>Quick Actions</Typography>
            <Grid container spacing={2}>
              <Grid item>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={() => testConnection(status.defaultAccount)}
                  disabled={!status.defaultAccount || !accounts.some(a => a.hasValidToken)}
                >
                  Test Email Send
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setShowSetupWizard(true);
                    setActiveStep(2);
                  }}
                >
                  Add Account
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => refreshAccountTokens(status.defaultAccount)}
                  disabled={!status.defaultAccount}
                >
                  Refresh Tokens
                </Button>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Authenticated Accounts Table */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Authenticated Accounts
            </Typography>
            
            {accounts.length === 0 ? (
              <Alert severity="warning">
                <AlertTitle>No Accounts Configured</AlertTitle>
                Please add at least one account to start sending emails.
                <Button size="small" sx={{ mt: 1 }} onClick={() => {
                  setShowSetupWizard(true);
                  setActiveStep(2);
                }}>
                  Add Account Now
                </Button>
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Token Expiry</TableCell>
                      <TableCell>Last Used</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {account.isDefault && (
                              <Tooltip title="Default Account">
                                <StarIcon color="primary" sx={{ mr: 1 }} />
                              </Tooltip>
                            )}
                            <Box>
                              <Typography variant="body1">
                                {account.displayName || account.email || 'Unknown'}
                              </Typography>
                              {account.email && (
                                <Typography variant="caption" color="textSecondary">
                                  {account.email}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {account.hasValidToken ? (
                            <Chip
                              label="Active"
                              color="success"
                              size="small"
                              icon={<CheckCircleIcon />}
                            />
                          ) : (
                            <Chip
                              label="Expired"
                              color="warning"
                              size="small"
                              icon={<WarningIcon />}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {getTimeUntilExpiry(account.tokenExpiresAt)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {formatDate(account.tokenExpiresAt)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {formatDate(account.lastUsed)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Test Connection">
                            <IconButton
                              size="small"
                              onClick={() => testConnection(account.id)}
                              disabled={!account.hasValidToken}
                            >
                              <CloudIcon />
                            </IconButton>
                          </Tooltip>
                          {!account.hasValidToken && (
                            <Tooltip title="Refresh Token">
                              <IconButton
                                size="small"
                                onClick={() => refreshAccountTokens(account.id)}
                              >
                                <RefreshIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!account.isDefault && (
                            <Tooltip title="Set as Default">
                              <IconButton
                                size="small"
                                onClick={() => setDefaultAccount(account.id)}
                              >
                                <StarBorderIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => deleteAccount(account.id)}
                              disabled={account.isDefault}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {/* Test Result */}
          {testResult && (
            <Alert 
              severity={testResult.success ? 'success' : 'error'} 
              sx={{ mt: 3 }}
              onClose={() => setTestResult(null)}
            >
              <AlertTitle>{testResult.success ? 'Test Successful' : 'Test Failed'}</AlertTitle>
              {testResult.message || testResult.error}
            </Alert>
          )}

          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
        </Paper>
      </Container>
    );
  }

  // Setup Wizard - Show when not configured or user clicks reconfigure
  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {status?.isConfigured ? 'Reconfigure Exchange Online' : 'Setup Exchange Online'}
            </Typography>
            
            {status?.isConfigured && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>Current Configuration</AlertTitle>
                You have an existing configuration. Creating a new app will replace the current one.
                <Button 
                  size="small" 
                  sx={{ mt: 1 }}
                  onClick={() => setShowSetupWizard(false)}
                >
                  Back to Status
                </Button>
              </Alert>
            )}
            
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Choose Setup Method:
            </Typography>
            
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Card 
                  sx={{ 
                    cursor: 'pointer', 
                    border: setupMode === 'automatic' ? '2px solid' : '1px solid',
                    borderColor: setupMode === 'automatic' ? 'primary.main' : 'divider',
                    '&:hover': { borderColor: 'primary.main' }
                  }}
                  onClick={() => setSetupMode('automatic')}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <AdminIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                      <Typography variant="h5">
                        Automatic Setup
                      </Typography>
                      <Chip label="Recommended" color="success" size="small" sx={{ ml: 'auto' }} />
                    </Box>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      Let the wizard automatically create and configure your Azure AD application with all required permissions.
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Automatic app creation" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Permission configuration" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Admin consent handling" />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    border: setupMode === 'manual' ? '2px solid' : '1px solid',
                    borderColor: setupMode === 'manual' ? 'primary.main' : 'divider',
                    '&:hover': { borderColor: 'primary.main' }
                  }}
                  onClick={() => setSetupMode('manual')}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <SettingsIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                      <Typography variant="h5">
                        Manual Setup
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      Manually enter your existing Azure AD application details.
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><CheckCircleIcon color="info" fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Use existing app" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircleIcon color="info" fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Manual configuration" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircleIcon color="info" fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Full control" />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            <Box mt={3} display="flex" justifyContent="flex-end">
              <Button 
                variant="contained" 
                onClick={() => setActiveStep(1)}
                disabled={!setupMode}
              >
                Continue
              </Button>
            </Box>
          </Box>
        );
        
      case 1:
        if (setupMode === 'automatic') {
          return (
            <AzureAdminSetup 
              onComplete={handleAutomaticSetupComplete}
              onCancel={() => setActiveStep(0)}
            />
          );
        } else {
          return (
            <ManualAzureSetup
              config={config}
              setConfig={setConfig}
              onNext={saveConfiguration}
              onBack={() => setActiveStep(0)}
            />
          );
        }
        
      case 2:
        return (
          <SimpleAzureSetup
            deviceCodeInfo={deviceCodeInfo}
            polling={polling}
            onSuccess={() => {
              checkStatus();
              handleNext();
            }}
          />
        );
        
      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Test Connection
            </Typography>
            <Alert severity="success" sx={{ mb: 2 }}>
              <AlertTitle>Configuration Complete!</AlertTitle>
              Your Exchange Online integration is ready. Test the connection below.
            </Alert>
            <Button 
              variant="contained" 
              onClick={() => testConnection(status?.defaultAccount)}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Test Connection'}
            </Button>
            {testResult && (
              <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                {testResult.message || testResult.error}
              </Alert>
            )}
            <Box mt={3}>
              <Button onClick={() => setShowSetupWizard(false)}>
                Go to Status Overview
              </Button>
            </Box>
          </Box>
        );
        
      default:
        return null;
    }
  };

  // Show Setup Wizard
  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 4, mt: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {renderStepContent(activeStep)}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
      </Paper>
    </Container>
  );
};

export default ExchangeSetup;