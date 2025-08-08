import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  CloudUpload as CloudIcon,
  Security as SecurityIcon,
  AdminPanelSettings as AdminIcon,
  PowerSettingsNew as PowerIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';

const AzureAdminSetup = ({ onComplete, onCancel }) => {
  const { apiRequest } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Setup data
  const [tenantId, setTenantId] = useState('');
  const [flowId, setFlowId] = useState(null);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState(null);
  const [polling, setPolling] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  
  // App configuration
  const [appConfig, setAppConfig] = useState({
    displayName: 'SMTP Relay for Exchange Online',
    authMethod: 'device_code',
    apiMethod: 'graph_api',
    useClientSecret: false,
    clientSecretExpiry: 365
  });
  
  const [appCreated, setAppCreated] = useState(null);
  
  const steps = ['Enter Tenant', 'Admin Authentication', 'Configure App', 'Create App'];
  
  // Polling for admin auth
  useEffect(() => {
    let pollInterval;
    if (polling && flowId) {
      pollInterval = setInterval(async () => {
        try {
          const response = await apiRequest('/api/azure-graph/admin/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flowId })
          });
          
          const data = await response.json();
          
          if (data.success) {
            setPolling(false);
            setAdminAuthenticated(true);
            setAdminInfo(data);
            setSuccess(`Authenticated as ${data.adminUser}`);
            setTimeout(() => setActiveStep(2), 2000);
          } else if (data.error) {
            setPolling(false);
            setError(data.error);
          }
        } catch (err) {
          // Continue polling on network errors
          console.log('Polling...', err.message);
        }
      }, 5000);
    }
    return () => clearInterval(pollInterval);
  }, [polling, flowId]);
  
  const startAdminAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/azure-graph/admin/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFlowId(data.flowId);
        setDeviceCodeInfo(data);
        setPolling(true);
        setActiveStep(1);
      } else {
        setError(data.error || 'Failed to start authentication');
      }
    } catch (err) {
      setError('Failed to start authentication: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const createApp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/azure-graph/admin/create-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId,
          appConfig
        })
      });
      
      // Check if response is ok (2xx status)
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create application');
      }
      
      const data = await response.json();
      
      setAppCreated(data);
      setSuccess('Application created successfully!');
      setActiveStep(3); // Ensure we stay on the success screen
      
      // If consent URL is provided, open it
      if (data.consentUrl) {
        setTimeout(() => {
          window.open(data.consentUrl, '_blank');
        }, 2000);
      }
      
      // Call onComplete after a delay to show success
      setTimeout(() => {
        if (onComplete) {
          onComplete({
            application: data.application,
            config: appConfig,
            success: true
          });
        }
      }, 5000); // Give more time to see the success message
      
    } catch (err) {
      console.error('App creation error:', err);
      setError(err.message || 'Failed to create application');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };
  
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Enter Tenant
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Azure AD Automatic Setup with Global Admin
            </Typography>
            
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Global Administrator Required</AlertTitle>
              This setup requires Global Administrator or Application Administrator privileges.
              The setup will use Microsoft Graph PowerShell to create the application.
            </Alert>
            
            <Card sx={{ mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <PowerIcon sx={{ mr: 1 }} />
                  <Typography variant="subtitle1">
                    Using Microsoft Graph PowerShell
                  </Typography>
                </Box>
                <Typography variant="body2">
                  Client ID: 14d82eec-204b-4c2f-b7e8-296a70dab67e
                </Typography>
                <Typography variant="body2">
                  This is Microsoft's official Graph PowerShell application with the necessary permissions.
                </Typography>
              </CardContent>
            </Card>
            
            <TextField
              fullWidth
              label="Tenant ID or Domain"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="contoso.onmicrosoft.com or xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              margin="normal"
              helperText="Enter your Azure AD tenant domain or ID"
              required
            />
            
            <Alert severity="info" sx={{ mt: 3 }}>
              <AlertTitle>What will happen:</AlertTitle>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckIcon /></ListItemIcon>
                  <ListItemText primary="You'll authenticate with your Global Admin account" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon /></ListItemIcon>
                  <ListItemText primary="A new Azure AD application will be created" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon /></ListItemIcon>
                  <ListItemText primary="Permissions will be configured automatically" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon /></ListItemIcon>
                  <ListItemText primary="Configuration will be saved to config.yml" />
                </ListItem>
              </List>
            </Alert>
            
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              onClick={startAdminAuth}
              disabled={!tenantId || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <AdminIcon />}
            >
              {loading ? 'Starting...' : 'Start Global Admin Authentication'}
            </Button>
          </Box>
        );
        
      case 1: // Admin Login
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Global Administrator Authentication
            </Typography>
            
            {deviceCodeInfo && (
              <>
                <Card sx={{ mt: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                  <CardContent>
                    <Typography variant="h3" align="center" gutterBottom>
                      {deviceCodeInfo.userCode}
                    </Typography>
                    <Box display="flex" justifyContent="center" mt={2}>
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<CopyIcon />}
                        onClick={() => copyToClipboard(deviceCodeInfo.userCode)}
                      >
                        Copy Code
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
                
                <Box mt={3} textAlign="center">
                  <Typography variant="body1" gutterBottom>
                    Visit this URL to authenticate:
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<LinkIcon />}
                    href={deviceCodeInfo.verificationUrl}
                    target="_blank"
                    sx={{ mt: 1 }}
                  >
                    {deviceCodeInfo.verificationUrl}
                  </Button>
                </Box>
                
                {polling && (
                  <Box mt={3} display="flex" alignItems="center" justifyContent="center">
                    <CircularProgress size={20} sx={{ mr: 2 }} />
                    <Typography>Waiting for Global Administrator authentication...</Typography>
                  </Box>
                )}
                
                <Alert severity="warning" sx={{ mt: 3 }}>
                  <AlertTitle>Important</AlertTitle>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="1. Sign in with a Global Administrator account" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="2. You'll see 'Microsoft Graph PowerShell' requesting permissions" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="3. Accept the permissions to continue" />
                    </ListItem>
                  </List>
                </Alert>
              </>
            )}
          </Box>
        );
        
      case 2: // Configure App
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Your Application
            </Typography>
            
            {adminInfo && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <AlertTitle>Admin Authenticated</AlertTitle>
                <Typography variant="body2">User: {adminInfo.adminUser}</Typography>
                {adminInfo.adminRoles?.length > 0 && (
                  <Typography variant="body2">
                    Roles: {adminInfo.adminRoles.join(', ')}
                  </Typography>
                )}
              </Alert>
            )}
            
            <TextField
              fullWidth
              label="Application Name"
              value={appConfig.displayName}
              onChange={(e) => setAppConfig({ ...appConfig, displayName: e.target.value })}
              margin="normal"
              helperText="Display name for your Azure AD application"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Authentication Method</InputLabel>
              <Select
                value={appConfig.authMethod}
                onChange={(e) => setAppConfig({ ...appConfig, authMethod: e.target.value })}
                label="Authentication Method"
              >
                <MenuItem value="device_code">Device Code Flow (User Context)</MenuItem>
                <MenuItem value="client_credentials">Client Credentials (App-Only)</MenuItem>
              </Select>
              <FormHelperText>
                Device Code: Send as specific user | Client Credentials: Send as any user
              </FormHelperText>
            </FormControl>
            
            <FormControl fullWidth margin="normal">
              <InputLabel>API Method</InputLabel>
              <Select
                value={appConfig.apiMethod}
                onChange={(e) => setAppConfig({ ...appConfig, apiMethod: e.target.value })}
                label="API Method"
              >
                <MenuItem value="graph_api">Microsoft Graph API</MenuItem>
                <MenuItem value="smtp_oauth">SMTP OAuth2</MenuItem>
              </Select>
            </FormControl>
            
            {appConfig.authMethod === 'client_credentials' && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={appConfig.useClientSecret}
                      onChange={(e) => setAppConfig({ ...appConfig, useClientSecret: e.target.checked })}
                    />
                  }
                  label="Create Client Secret"
                  sx={{ mt: 2 }}
                />
                
                {appConfig.useClientSecret && (
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Secret Expiry</InputLabel>
                    <Select
                      value={appConfig.clientSecretExpiry}
                      onChange={(e) => setAppConfig({ ...appConfig, clientSecretExpiry: e.target.value })}
                      label="Secret Expiry"
                    >
                      <MenuItem value={90}>3 Months</MenuItem>
                      <MenuItem value={180}>6 Months</MenuItem>
                      <MenuItem value={365}>1 Year</MenuItem>
                      <MenuItem value={730}>2 Years (Maximum)</MenuItem>
                    </Select>
                  </FormControl>
                )}
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  Client Credentials requires admin consent after creation.
                </Alert>
              </>
            )}
            
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              onClick={() => setActiveStep(3)}
              startIcon={<CloudIcon />}
            >
              Review & Create Application
            </Button>
          </Box>
        );
        
      case 3: // Create App
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Create Application
            </Typography>
            
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>Configuration Summary:</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Application Name"
                      secondary={appConfig.displayName}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Authentication Method"
                      secondary={appConfig.authMethod === 'device_code' ? 'Device Code Flow' : 'Client Credentials'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="API Method"
                      secondary={appConfig.apiMethod === 'graph_api' ? 'Microsoft Graph' : 'SMTP OAuth2'}
                    />
                  </ListItem>
                  {appConfig.useClientSecret && (
                    <ListItem>
                      <ListItemText 
                        primary="Client Secret"
                        secondary={`Expires in ${appConfig.clientSecretExpiry} days`}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
            
            {appCreated ? (
              <>
                <Alert severity="success" sx={{ mt: 3 }}>
                  <AlertTitle>✅ Application Created Successfully!</AlertTitle>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    <strong>Application Name:</strong> {appCreated.application.displayName}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Application ID:</strong> {appCreated.application.appId}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Tenant ID:</strong> {appCreated.application.tenantId}
                  </Typography>
                  {appCreated.clientSecret && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      ✅ Client secret has been saved to config.yml
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
                    {appCreated.nextSteps}
                  </Typography>
                </Alert>
                
                {appCreated.consentUrl && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <AlertTitle>Admin Consent Required</AlertTitle>
                    <Typography>A new window will open for admin consent.</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      href={appCreated.consentUrl}
                      target="_blank"
                      sx={{ mt: 1 }}
                    >
                      Grant Admin Consent
                    </Button>
                  </Alert>
                )}
                
                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Setup complete! Redirecting in a few seconds...
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ mt: 2 }}
                    onClick={() => {
                      if (onComplete) {
                        onComplete({
                          application: appCreated.application,
                          config: appConfig,
                          success: true
                        });
                      }
                    }}
                  >
                    Continue to Dashboard
                  </Button>
                </Box>
              </>
            ) : (
              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 3 }}
                onClick={createApp}
                disabled={loading}
                color="success"
                startIcon={loading ? <CircularProgress size={20} /> : <CloudIcon />}
              >
                {loading ? 'Creating Application...' : 'Create Application in Azure AD'}
              </Button>
            )}
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Paper sx={{ p: 4 }}>
      <Box display="flex" alignItems="center" mb={2}>
        <AdminIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
        <Typography variant="h5">
          Azure AD Automatic Setup (Global Admin)
        </Typography>
      </Box>
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {renderStepContent()}
      
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
      
      <Box display="flex" justifyContent="space-between" mt={3}>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        {activeStep > 0 && activeStep < 3 && !polling && (
          <Button onClick={() => setActiveStep(activeStep - 1)}>
            Back
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default AzureAdminSetup;