import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  InputAdornment,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fade,
  Grow,
  Collapse,
  useTheme
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext-Debug';
import SimpleAzureSetup from '../components/SimpleAzureSetup';
import ManualAzureSetup from '../components/ManualAzureSetup';
import AzureAdminSetup from '../components/AzureAdminSetup';
import ExchangeStatusDashboard from '../components/ExchangeStatusDashboard';
import ErrorBoundary from '../components/ErrorBoundary';
import { motion } from 'framer-motion';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
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
  Send as SendIcon,
  AutoAwesome as AutoAwesomeIcon,
  RocketLaunch as RocketIcon,
  Shield as ShieldIcon,
  Bolt as BoltIcon,
  SyncAlt as SyncIcon,
  CloudSync as CloudSyncIcon,
  MailOutline as MailIcon,
  Groups as GroupsIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

// Constants
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const POLL_INTERVAL_MULTIPLIER = 1000;
const CLIPBOARD_SUCCESS_TIMEOUT = 2000;
const SETUP_STEPS = ['Choose Method', 'Configure Azure AD', 'Authenticate', 'Test Connection'];

// Motion components
const MotionCard = motion(Card);
const MotionBox = motion(Box);

const ExchangeSetup = () => {
  const { apiRequest } = useAuth();
  const theme = useTheme();
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
  const [showUserAuthDialog, setShowUserAuthDialog] = useState(false); // New state for user auth dialog
  const [dashboardKey, setDashboardKey] = useState(0); // Key to force dashboard refresh

  const steps = useMemo(() => SETUP_STEPS, []);

  // Define all callbacks before useEffects to avoid initialization errors
  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/exchange-config/status');
      const data = await response.json();
      console.log('Exchange status data:', data); // Debug log
      setStatus(data);
      setAccounts(data.accounts || []);
      
      // Show dashboard if configured OR if we have applications
      // Check multiple conditions to determine if setup is complete
      const hasConfig = data.isConfigured || data.hasConfig;
      const hasApplications = data.applications?.length > 0;
      const hasTokens = data.hasTokens;
      const hasClientId = data.clientId || data.exchangeConfig?.auth?.client_id;
      
      console.log('Setup check:', { hasConfig, hasApplications, hasTokens, hasClientId }); // Debug log
      
      if (hasConfig || hasApplications || (hasClientId && hasTokens)) {
        console.log('Showing dashboard view');
        setShowSetupWizard(false);
      } else {
        console.log('Showing setup wizard');
        setShowSetupWizard(true);
      }
    } catch (err) {
      console.error('Failed to check status:', err);
      setShowSetupWizard(true);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => prev + 1);
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => {
      const newStep = Math.max(0, prev - 1);
      // Only reset setupMode if going back FROM step 1 TO step 0
      // This means user wants to change the setup method
      if (prev === 1 && newStep === 0) {
        setSetupMode('choose');
      }
      return newStep;
    });
  }, []);

  const handleReset = useCallback(() => {
    setActiveStep(0);
    setDeviceCodeInfo(null);
    setPolling(false);
    setTestResult(null);
    setError(null);
    setSuccess(null);
  }, []);

  const startAuthentication = useCallback(async (skipWizardNext = false) => {
    setLoading(true);
    setError(null);
    try {
      // Get existing app config from status
      const app = status?.applications?.[0];
      if (!app) {
        setError('No Azure AD application configured. Please complete setup first.');
        setLoading(false);
        return;
      }
      
      const response = await apiRequest('/api/exchange-config/oauth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          authMethod: 'device_code',
          tenantId: app.tenantId,
          clientId: app.appId,
          apiMethod: 'graph_api'
        })
      });
      
      const data = await response.json();
      setDeviceCodeInfo(data);
      setPolling(true);
      // Only go to next step if we're in the wizard
      if (!skipWizardNext && showSetupWizard) {
        handleNext();
      }
    } catch (err) {
      setError('Failed to start authentication');
    } finally {
      setLoading(false);
    }
  }, [status, showSetupWizard, apiRequest, handleNext]);

  const pollForToken = useCallback(async () => {
    try {
      const response = await apiRequest('/api/exchange-config/oauth/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deviceCode: deviceCodeInfo.deviceCode,
          tenantId: status?.applications?.[0]?.tenantId,
          clientId: status?.applications?.[0]?.appId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setPolling(false);
        setSuccess('Authentication successful!');
        await checkStatus();
        // If we're adding a user mailbox, close the dialog
        if (showUserAuthDialog) {
          setShowUserAuthDialog(false);
          setDeviceCodeInfo(null);
          // Force dashboard refresh by changing key
          setDashboardKey(prev => prev + 1);
        } else if (showSetupWizard) {
          handleNext();
        }
      }
    } catch (err) {
      if (!err.message?.includes('authorization_pending')) {
        setError('Authentication failed');
        setPolling(false);
      }
    }
  }, [deviceCodeInfo, status, apiRequest, showUserAuthDialog, showSetupWizard, handleNext, checkStatus]);

  const saveConfiguration = useCallback(async () => {
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
  }, [config, apiRequest, checkStatus, startAuthentication, handleNext]);

  const testConnection = useCallback(async (accountId) => {
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
  }, [apiRequest]);

  const refreshAccountTokens = useCallback(async (accountId) => {
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
  }, [apiRequest, checkStatus]);

  const setDefaultAccount = useCallback(async (accountId) => {
    try {
      await apiRequest(`/api/exchange-config/accounts/${accountId}/set-default`, {
        method: 'POST'
      });
      await checkStatus();
    } catch (err) {
      setError('Failed to set default account');
    }
  }, [apiRequest, checkStatus]);

  const deleteAccount = useCallback(async (accountId) => {
    try {
      await apiRequest(`/api/exchange-config/accounts/${accountId}`, {
        method: 'DELETE'
      });
      await checkStatus();
    } catch (err) {
      setError('Failed to delete account');
    }
  }, [apiRequest, checkStatus]);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setSuccess('Copied to clipboard!');
        setTimeout(() => setSuccess(null), CLIPBOARD_SUCCESS_TIMEOUT);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        setError('Failed to copy to clipboard');
      });
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }, []);

  const getTimeUntilExpiry = useCallback((expiryDate) => {
    if (!expiryDate) return 'Expired';
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days ${hours} hours`;
    return `${hours} hours`;
  }, []);

  const handleAutomaticSetupComplete = useCallback(async (result) => {
    if (result && result.success) {
      setSuccess('Azure AD application created successfully!');
      // Refresh the status to show the new configuration
      await checkStatus();
      // Hide the wizard and show the status overview
      setShowSetupWizard(false);
      // Optionally show a success notification
      if (result.application) {
        setSuccess(`Application "${result.application.displayName}" created successfully! Application ID: ${result.application.appId}`);
      }
    }
  }, [checkStatus]);

  // useEffects should come after callback definitions
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    let pollInterval;
    if (polling && deviceCodeInfo) {
      pollInterval = setInterval(() => {
        pollForToken();
      }, (deviceCodeInfo.interval || 5) * POLL_INTERVAL_MULTIPLIER);
    }
    return () => clearInterval(pollInterval);
  }, [polling, deviceCodeInfo, pollForToken]);

  if (loading && !status) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <MotionBox
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Paper sx={{ p: 4, borderRadius: 4, boxShadow: 6 }}>
            <Box display="flex" flexDirection="column" alignItems="center">
              <CircularProgress size={60} thickness={4} />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Loading Exchange Configuration...
              </Typography>
            </Box>
          </Paper>
        </MotionBox>
      </Box>
    );
  }

  // Main Status Overview - Show when configured or when setup is complete
  if ((status?.isConfigured || status?.applications?.length > 0) && !showSetupWizard) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: theme.palette.mode === 'dark'
          ? theme.palette.background.default
          : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        py: 4
      }}>
        <ExchangeStatusDashboard 
          key={dashboardKey}
          onSetupStart={() => setShowSetupWizard(true)}
          onEdit={(item) => {
            // Handle edit actions based on type
            console.log('Edit item:', item);
            if (item?.type === 'mailbox') {
              // For mailbox, show user authentication dialog
              setShowUserAuthDialog(true);
              startAuthentication(true); // Skip wizard navigation
            } else {
              setShowSetupWizard(true);
            }
          }}
        />
        
        {/* User Authentication Dialog for Add Mailbox */}
        <Dialog
          open={showUserAuthDialog}
          onClose={() => {
            setShowUserAuthDialog(false);
            setPolling(false);
            setDeviceCodeInfo(null);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <MailIcon color="primary" />
              <Typography variant="h6">Add User Mailbox</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            {deviceCodeInfo ? (
              <>
                <Typography variant="body1" gutterBottom>
                  Authenticate the user account that will send emails:
                </Typography>
                
                <MotionCard
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  sx={{ 
                    mt: 2, 
                    background: theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, #4c63b6 0%, #542f75 100%)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                  }}
                >
                  <CardContent>
                    <Typography variant="h2" align="center" gutterBottom sx={{ fontWeight: 'bold', letterSpacing: 3 }}>
                      {deviceCodeInfo.userCode}
                    </Typography>
                    <Box display="flex" justifyContent="center" mt={2}>
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<CopyIcon />}
                        onClick={() => copyToClipboard(deviceCodeInfo.userCode)}
                        sx={{ 
                          borderRadius: 3,
                          textTransform: 'none',
                          fontWeight: 'bold'
                        }}
                      >
                        Copy Code
                      </Button>
                    </Box>
                  </CardContent>
                </MotionCard>
                
                <Box mt={3} textAlign="center">
                  <Typography variant="body2" gutterBottom color="textSecondary">
                    Go to this URL and enter the code:
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    href={deviceCodeInfo.verificationUrl || 'https://microsoft.com/devicelogin'}
                    target="_blank"
                    sx={{ 
                      mt: 1,
                      borderRadius: 3,
                      textTransform: 'none'
                    }}
                  >
                    microsoft.com/devicelogin
                  </Button>
                </Box>
                
                {polling && (
                  <Fade in={polling}>
                    <Box mt={3} display="flex" alignItems="center" justifyContent="center">
                      <CircularProgress size={20} sx={{ mr: 2 }} />
                      <Typography>Waiting for user authentication...</Typography>
                    </Box>
                  </Fade>
                )}
                
                <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
                  <AlertTitle>Important</AlertTitle>
                  The user must:
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Sign in with their Exchange account" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Accept the Mail.Send permission" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Grant permission to send emails as this user" />
                    </ListItem>
                  </List>
                </Alert>
              </>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => {
                setShowUserAuthDialog(false);
                setPolling(false);
                setDeviceCodeInfo(null);
              }}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Setup Wizard - Show when not configured or user clicks reconfigure
  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Fade in={true}>
            <Box>
              <Box textAlign="center" mb={4}>
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <CloudSyncIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h4" gutterBottom fontWeight="bold">
                    {status?.isConfigured ? 'Reconfigure Exchange Online' : 'Welcome to Exchange Online Setup'}
                  </Typography>
                  <Typography variant="subtitle1" color="textSecondary">
                    Connect your Microsoft Exchange to enable email functionality
                  </Typography>
                </motion.div>
              </Box>
              
              {status?.isConfigured && (
                <Grow in={true}>
                  <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    <AlertTitle>Current Configuration</AlertTitle>
                    You have an existing configuration. Creating a new app will replace the current one.
                    <Button 
                      size="small" 
                      startIcon={<ArrowBackIcon />}
                      sx={{ 
                        mt: 1,
                        color: theme.palette.mode === 'dark'
                          ? theme.palette.grey[300]
                          : theme.palette.grey[700],
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                      onClick={() => setShowSetupWizard(false)}
                    >
                      Back to Dashboard
                    </Button>
                  </Alert>
                </Grow>
              )}
              
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2, fontWeight: 'medium' }}>
                Choose Your Setup Method:
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <MotionCard
                    whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                    whileTap={{ scale: 0.98 }}
                    sx={{ 
                      cursor: 'pointer', 
                      border: setupMode === 'automatic' ? '2px solid' : '1px solid',
                      borderColor: setupMode === 'automatic' ? 'primary.main' : 'divider',
                      borderRadius: 3,
                      overflow: 'hidden',
                      position: 'relative',
                      background: setupMode === 'automatic' 
                        ? theme.palette.mode === 'dark'
                          ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                          : 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)'
                        : 'transparent'
                    }}
                    onClick={() => setSetupMode('automatic')}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: 2,
                          p: 1,
                          mr: 2,
                          display: 'flex'
                        }}>
                          <AutoAwesomeIcon sx={{ fontSize: 32, color: 'white' }} />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="h5" fontWeight="bold">
                            Automatic Setup
                          </Typography>
                          <Chip 
                            label="Recommended" 
                            color="success" 
                            size="small" 
                            sx={{ mt: 0.5 }}
                            icon={<BoltIcon />}
                          />
                        </Box>
                      </Box>
                      <Typography variant="body2" color="textSecondary" paragraph>
                        Let the wizard automatically create and configure your Azure AD application with all required permissions.
                      </Typography>
                      <List dense>
                        <ListItem sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="One-click setup" 
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                        <ListItem sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Automatic permissions" 
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                        <ListItem sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Admin consent handling" 
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </MotionCard>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <MotionCard
                    whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                    whileTap={{ scale: 0.98 }}
                    sx={{ 
                      cursor: 'pointer',
                      border: setupMode === 'manual' ? '2px solid' : '1px solid',
                      borderColor: setupMode === 'manual' ? 'primary.main' : 'divider',
                      borderRadius: 3,
                      overflow: 'hidden',
                      position: 'relative',
                      background: setupMode === 'manual' 
                        ? theme.palette.mode === 'dark'
                          ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                          : 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)'
                        : 'transparent'
                    }}
                    onClick={() => setSetupMode('manual')}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                          borderRadius: 2,
                          p: 1,
                          mr: 2,
                          display: 'flex'
                        }}>
                          <SettingsIcon sx={{ fontSize: 32, color: 'white' }} />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="h5" fontWeight="bold">
                            Manual Setup
                          </Typography>
                          <Chip 
                            label="Advanced" 
                            color="info" 
                            size="small" 
                            sx={{ mt: 0.5 }}
                            icon={<BuildIcon />}
                          />
                        </Box>
                      </Box>
                      <Typography variant="body2" color="textSecondary" paragraph>
                        Manually enter your existing Azure AD application details for complete control.
                      </Typography>
                      <List dense>
                        <ListItem sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon color="info" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Use existing app" 
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                        <ListItem sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon color="info" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Custom configuration" 
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                        <ListItem sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon color="info" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Full control" 
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </MotionCard>
                </Grid>
              </Grid>
              
              <Box mt={4} display="flex" justifyContent="center">
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={() => setActiveStep(1)}
                  disabled={!setupMode}
                  startIcon={<RocketIcon />}
                  sx={{ 
                    borderRadius: 3,
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    background: setupMode 
                      ? theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #4c63b6 0%, #542f75 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : undefined
                  }}
                >
                  Continue with {setupMode === 'automatic' ? 'Automatic' : setupMode === 'manual' ? 'Manual' : ''} Setup
                </Button>
              </Box>
            </Box>
          </Fade>
        );
        
      case 1:
        if (setupMode === 'automatic') {
          return (
            <ErrorBoundary onReset={() => setActiveStep(0)}>
              <AzureAdminSetup 
                onComplete={handleAutomaticSetupComplete}
                onBack={handleBack}
              />
            </ErrorBoundary>
          );
        } else {
          return (
            <ManualAzureSetup
              onComplete={() => checkStatus()}
              onBack={handleBack}
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
          <Fade in={true}>
            <Box textAlign="center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
              </motion.div>
              <Typography variant="h4" gutterBottom fontWeight="bold">
                Configuration Complete!
              </Typography>
              <Typography variant="subtitle1" color="textSecondary" paragraph>
                Your Exchange Online integration is ready to use.
              </Typography>
              
              <Box mt={4}>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={() => testConnection(status?.defaultAccount)}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  sx={{ 
                    borderRadius: 3,
                    px: 4,
                    py: 1.5,
                    mr: 2,
                    textTransform: 'none',
                    background: theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, #4c63b6 0%, #542f75 100%)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  }}
                >
                  Test Connection
                </Button>
                <Button 
                  variant="outlined"
                  size="large" 
                  onClick={() => setShowSetupWizard(false)}
                  sx={{ 
                    borderRadius: 3,
                    px: 4,
                    py: 1.5,
                    textTransform: 'none'
                  }}
                >
                  Go to Dashboard
                </Button>
              </Box>
              
              {testResult && (
                <Grow in={true}>
                  <Alert 
                    severity={testResult.success ? 'success' : 'error'} 
                    sx={{ mt: 3, borderRadius: 2 }}
                  >
                    <AlertTitle>{testResult.success ? 'Test Successful' : 'Test Failed'}</AlertTitle>
                    {testResult.message || testResult.error}
                  </Alert>
                </Grow>
              )}
            </Box>
          </Fade>
        );
        
      default:
        return null;
    }
  };

  // Show Setup Wizard
  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: theme.palette.mode === 'dark'
        ? theme.palette.background.default
        : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      py: 4
    }}>
      <MotionBox
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        sx={{ maxWidth: 1200, mx: 'auto', px: 3 }}
      >
        <Paper sx={{ 
          p: { xs: 3, md: 5 }, 
          borderRadius: 4,
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Box display="flex" alignItems="center" gap={2}>
              <CloudSyncIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              <Typography variant="h4" fontWeight="bold">
                Exchange Online Setup
              </Typography>
            </Box>
            {/* Back button - only show when NOT displaying child components */}
            {activeStep > 0 && !(activeStep === 1 && (setupMode === 'automatic' || setupMode === 'manual')) && (
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                sx={{ 
                  borderRadius: 2,
                  borderColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.23)' 
                    : 'rgba(0, 0, 0, 0.23)',
                  color: theme.palette.mode === 'dark'
                    ? theme.palette.grey[300]
                    : theme.palette.grey[700],
                  '&:hover': {
                    borderColor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.4)'
                      : 'rgba(0, 0, 0, 0.4)',
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                Back
              </Button>
            )}
          </Box>
          
          {/* Only show stepper for manual setup or when choosing method - automatic setup has its own stepper */}
          {(activeStep === 0 || setupMode !== 'automatic') && (
            <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
              {steps.map((label, index) => (
                <Step key={label}>
                  <StepLabel
                    StepIconProps={{
                      sx: {
                        fontSize: 28,
                        '&.Mui-completed': {
                          color: 'success.main'
                        },
                        '&.Mui-active': {
                          color: 'primary.main'
                        }
                      }
                    }}
                  >
                    <Typography variant="body1" fontWeight={activeStep === index ? 'bold' : 'normal'}>
                      {label}
                    </Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          )}
          
          <Box sx={{ minHeight: 400 }}>
            {renderStepContent(activeStep)}
          </Box>
          
          {/* Never show parent's alerts when using automatic setup (AzureAdminSetup manages its own) */}
          {setupMode !== 'automatic' && (
            <>
              <Collapse in={!!error}>
                <Alert 
                  severity="error" 
                  sx={{ mt: 3, borderRadius: 2 }} 
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              </Collapse>
              
              <Collapse in={!!success}>
                <Alert 
                  severity="success" 
                  sx={{ mt: 3, borderRadius: 2 }} 
                  onClose={() => setSuccess(null)}
                >
                  {success}
                </Alert>
              </Collapse>
            </>
          )}
        </Paper>
      </MotionBox>
    </Box>
  );
};

export default ExchangeSetup;