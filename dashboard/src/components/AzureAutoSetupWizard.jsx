import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  CloudUpload as CloudIcon,
  Security as SecurityIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon,
  Launch as LaunchIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';
import ExchangeSetupConfiguration from './ExchangeSetupConfiguration';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const AzureAutoSetupWizard = ({ onComplete, onCancel }) => {
  const { apiRequest } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [adminAuth, setAdminAuth] = useState(null);
  const [setupProgress, setSetupProgress] = useState({});
  const [appRegistration, setAppRegistration] = useState(null);
  const [serviceAccount, setServiceAccount] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [setupMode, setSetupMode] = useState('guided'); // 'guided' or 'advanced'
  const [appConfig, setAppConfig] = useState({
    displayName: 'SMTP Relay for Exchange Online',
    appName: 'smtp-relay-' + Date.now(),
    redirectUris: ['http://localhost:3001/auth/callback'],
    useClientSecret: false,
    clientSecretExpiry: 365, // days
    authMethod: 'device_code',
    apiMethod: 'graph_api',
    permissions: {
      delegated: ['User.Read', 'Mail.Send'],
      application: ['Mail.Send']
    },
    autoConsent: true,
    createNewApp: true, // or use existing
    existingAppId: '',
    requiredResourceAccess: [
      {
        resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
        resourceAccess: [
          {
            id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
            type: 'Scope'
          },
          {
            id: 'b633e1c5-b582-4048-a93e-9f11b44c7e96', // Mail.Send
            type: 'Role'
          }
        ]
      }
    ]
  });

  const steps = [
    'Admin Authentication',
    'App Registration',
    'Service Account Setup', 
    'Test & Verify'
  ];

  const progressSteps = [
    'Authenticating admin user',
    'Creating Azure AD application',
    'Configuring permissions',
    'Setting up redirect URIs',
    'Granting admin consent',
    'Saving configuration'
  ];

  useEffect(() => {
    // Initialize redirect URIs based on current host
    const protocol = window.location.protocol;
    const host = window.location.host;
    const callbackUri = `${protocol}//${host}/auth/callback`;
    
    setAppConfig(prev => ({
      ...prev,
      redirectUris: [callbackUri, 'http://localhost:3001/auth/callback']
    }));
  }, []);

  const authenticateAdmin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/exchange-config/azure/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Redirect to Microsoft login
        window.location.href = data.authUrl;
      } else {
        setError(data.error || 'Failed to initiate admin authentication');
      }
    } catch (err) {
      setError('Failed to start admin authentication: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthCallback = async (code) => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/exchange-config/azure/admin-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAdminAuth(data.adminAuth);
        setActiveStep(1);
        setSuccess('Admin authentication successful!');
      } else {
        setError(data.error || 'Admin authentication failed');
      }
    } catch (err) {
      setError('Authentication callback failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const createApplication = async () => {
    if (!adminAuth) {
      setError('Admin authentication required');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSetupProgress({});
    
    try {
      const response = await apiRequest('/api/exchange-config/azure/create-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appConfig,
          adminToken: adminAuth.accessToken
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create application');
      }

      // Handle streaming progress updates
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setSetupProgress(prev => ({
                  ...prev,
                  [data.step]: { status: data.status, message: data.message }
                }));
              } else if (data.type === 'complete') {
                setAppRegistration(data.appRegistration);
                setActiveStep(2);
                setSuccess('Application created successfully!');
                break;
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.warn('Failed to parse progress data:', line);
            }
          }
        }
      }
    } catch (err) {
      setError('Failed to create application: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupServiceAccount = async () => {
    if (!serviceAccount.trim()) {
      setError('Please specify a service account email');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/exchange-config/azure/setup-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: appRegistration.appId,
          tenantId: appRegistration.tenantId,
          serviceAccount: serviceAccount,
          adminToken: adminAuth.accessToken
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActiveStep(3);
        setSuccess('Service account configured successfully!');
      } else {
        setError(data.error || 'Failed to configure service account');
      }
    } catch (err) {
      setError('Service account setup failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setTestResult(null);
    
    try {
      const response = await apiRequest('/api/exchange-config/azure/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: appRegistration.appId,
          tenantId: appRegistration.tenantId,
          serviceAccount: serviceAccount
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResult(data);
        setSuccess('Connection test successful!');
      } else {
        setError(data.error || 'Connection test failed');
      }
    } catch (err) {
      setError('Test failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    try {
      await onComplete({
        appRegistration,
        serviceAccount,
        testResult
      });
    } catch (err) {
      setError('Failed to complete setup: ' + err.message);
    }
  };

  const renderAdminAuthStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Administrator Authentication
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Global Administrator Required</AlertTitle>
        This process requires a Global Administrator account to automatically create and configure the Azure AD application.
      </Alert>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            What this step does:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><SecurityIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Authenticate with Microsoft 365" 
                secondary="Secure OAuth2 flow to verify administrator privileges"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CloudIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Access Microsoft Graph API" 
                secondary="Required permissions to create and configure applications"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
      
      {!adminAuth ? (
        <Button
          variant="contained"
          size="large"
          startIcon={<AccountIcon />}
          onClick={authenticateAdmin}
          disabled={loading}
          sx={{ mt: 2 }}
        >
          {loading ? 'Redirecting...' : 'Sign in as Global Admin'}
        </Button>
      ) : (
        <Alert severity="success" sx={{ mt: 2 }}>
          <AlertTitle>Authentication Successful</AlertTitle>
          Signed in as: <strong>{adminAuth.displayName}</strong> ({adminAuth.userPrincipalName})
        </Alert>
      )}
    </Box>
  );

  const renderAppRegistrationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure Application Settings
      </Typography>
      
      {appConfig.setupMode === 'guided' ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Automatic Configuration</AlertTitle>
          The wizard will create your Azure AD application with recommended settings. You can customize these if needed.
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Advanced Configuration Mode</AlertTitle>
          You have full control over all settings. Make sure you understand the implications of your choices.
        </Alert>
      )}

      {/* Configuration Component */}
      <ExchangeSetupConfiguration 
        config={appConfig}
        onChange={setAppConfig}
        mode="setup"
      />

      {loading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Setup Progress:
            </Typography>
            <LinearProgress sx={{ mb: 2 }} />
            {progressSteps.map((step, index) => {
              const progress = setupProgress[step];
              return (
                <Box key={step} display="flex" alignItems="center" mb={1}>
                  {progress?.status === 'complete' ? (
                    <CheckIcon color="success" sx={{ mr: 1 }} />
                  ) : progress?.status === 'error' ? (
                    <ErrorIcon color="error" sx={{ mr: 1 }} />
                  ) : progress?.status === 'in_progress' ? (
                    <Box sx={{ width: 20, height: 20, mr: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <LinearProgress sx={{ width: 16 }} />
                    </Box>
                  ) : (
                    <Box sx={{ width: 20, height: 20, mr: 1 }} />
                  )}
                  <Typography variant="body2" color={progress?.status === 'error' ? 'error' : 'inherit'}>
                    {step}
                    {progress?.message && `: ${progress.message}`}
                  </Typography>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}

      {appRegistration && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Application Created Successfully</AlertTitle>
          <Typography><strong>Application ID:</strong> {appRegistration.appId}</Typography>
          <Typography><strong>Tenant ID:</strong> {appRegistration.tenantId}</Typography>
          <Typography><strong>Object ID:</strong> {appRegistration.id}</Typography>
        </Alert>
      )}

      <Box display="flex" gap={2}>
        <Button
          variant="contained"
          onClick={createApplication}
          disabled={loading || !adminAuth || appRegistration}
          startIcon={<CloudIcon />}
        >
          {loading ? 'Creating Application...' : 'Create Application'}
        </Button>
        
      </Box>

    </Box>
  );

  const renderServiceAccountStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Service Account Configuration
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Service Account Setup</AlertTitle>
        Specify the service account that will be used to send emails through Exchange Online.
      </Alert>

      <TextField
        fullWidth
        label="Service Account Email"
        value={serviceAccount}
        onChange={(e) => setServiceAccount(e.target.value)}
        placeholder="smtp-service@yourdomain.com"
        helperText="This account will be used as the 'from' address for emails sent through the relay"
        margin="normal"
      />

      <Card sx={{ mt: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Requirements:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><PersonAddIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Valid Exchange Online mailbox" 
                secondary="The account must have an active Exchange Online license"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><SecurityIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Modern authentication enabled" 
                secondary="Basic authentication should be disabled for security"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        onClick={setupServiceAccount}
        disabled={loading || !serviceAccount.trim()}
        startIcon={<SettingsIcon />}
        sx={{ mt: 2 }}
      >
        {loading ? 'Configuring...' : 'Configure Service Account'}
      </Button>
    </Box>
  );

  const renderTestStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Test & Verify Configuration
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Final Verification</AlertTitle>
        Test the connection to ensure everything is configured correctly.
      </Alert>

      {testResult && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Connection Test Successful</AlertTitle>
          <Typography><strong>Service Account:</strong> {testResult.serviceAccount}</Typography>
          <Typography><strong>Tenant:</strong> {testResult.tenantId}</Typography>
          <Typography><strong>Permissions:</strong> {testResult.permissions?.join(', ')}</Typography>
        </Alert>
      )}

      <Box display="flex" gap={2} mt={3}>
        <Button
          variant="contained"
          onClick={testConnection}
          disabled={loading}
          startIcon={<LaunchIcon />}
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </Button>
        
        {testResult && (
          <Button
            variant="contained"
            color="success"
            onClick={completeSetup}
            startIcon={<CheckIcon />}
          >
            Complete Setup
          </Button>
        )}
      </Box>
    </Box>
  );

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Automatic Azure AD Setup
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        This wizard will automatically create and configure your Azure AD application for Exchange Online integration.
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>Admin Authentication</StepLabel>
          <StepContent>
            {renderAdminAuthStep()}
          </StepContent>
        </Step>
        
        <Step>
          <StepLabel>App Registration</StepLabel>
          <StepContent>
            {renderAppRegistrationStep()}
          </StepContent>
        </Step>
        
        <Step>
          <StepLabel>Service Account Setup</StepLabel>
          <StepContent>
            {renderServiceAccountStep()}
          </StepContent>
        </Step>
        
        <Step>
          <StepLabel>Test & Verify</StepLabel>
          <StepContent>
            {renderTestStep()}
          </StepContent>
        </Step>
      </Stepper>

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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        
        {activeStep < steps.length - 1 && activeStep > 0 && (
          <Button
            variant="contained"
            onClick={() => setActiveStep(prev => prev + 1)}
            disabled={
              (activeStep === 0 && !adminAuth) ||
              (activeStep === 1 && !appRegistration) ||
              (activeStep === 2 && !serviceAccount.trim())
            }
          >
            Next Step
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default AzureAutoSetupWizard;