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
  FormHelperText
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  CloudUpload as CloudIcon,
  Security as SecurityIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';

const SimpleAzureSetup = ({ onComplete }) => {
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
  
  // App configuration
  const [appConfig, setAppConfig] = useState({
    displayName: 'SMTP Relay for Exchange Online',
    authMethod: 'device_code',
    apiMethod: 'graph_api',
    useClientSecret: false,
    clientSecretExpiry: 365
  });
  
  const [appCreated, setAppCreated] = useState(null);
  
  const steps = ['Enter Tenant', 'Admin Login', 'Configure App', 'Create App'];
  
  // Polling for admin auth
  useEffect(() => {
    let pollInterval;
    if (polling && flowId) {
      pollInterval = setInterval(async () => {
        try {
          const response = await apiRequest('/api/azure-setup/setup/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flowId })
          });
          
          const data = await response.json();
          
          if (data.success) {
            setPolling(false);
            setAdminAuthenticated(true);
            // Don't show duplicate success message, user is already shown in the UI
            setTimeout(() => setActiveStep(2), 2000);
          } else if (data.error) {
            setPolling(false);
            setError(data.error);
          }
        } catch (err) {
          setPolling(false);
          setError(err.message);
        }
      }, 5000);
    }
    return () => clearInterval(pollInterval);
  }, [polling, flowId]);
  
  const startAdminAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/azure-setup/setup/init', {
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
      const response = await apiRequest('/api/azure-setup/setup/create-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId,
          appConfig
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAppCreated(data);
        setSuccess('Application created successfully!');
        setTimeout(() => {
          onComplete({
            application: data.application,
            config: appConfig
          });
        }, 3000);
      } else {
        setError(data.error || 'Failed to create application');
      }
    } catch (err) {
      setError('Failed to create application: ' + err.message);
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
              Enter Your Azure Tenant Information
            </Typography>
            
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
              <AlertTitle>What you'll need:</AlertTitle>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckIcon /></ListItemIcon>
                  <ListItemText primary="Global Administrator access to your Azure AD tenant" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon /></ListItemIcon>
                  <ListItemText primary="Permission to create applications in Azure AD" />
                </ListItem>
              </List>
            </Alert>
            
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              onClick={startAdminAuth}
              disabled={!tenantId || loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SecurityIcon />}
            >
              {loading ? 'Starting...' : 'Start Admin Authentication'}
            </Button>
          </Box>
        );
        
      case 1: // Admin Login
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Admin Authentication
            </Typography>
            
            {deviceCodeInfo && (
              <>
                <Card sx={{ mt: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  <CardContent>
                    <Typography variant="h4" align="center" gutterBottom>
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
                    variant="outlined"
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
                    <Typography>Waiting for authentication...</Typography>
                  </Box>
                )}
                
                <Alert severity="info" sx={{ mt: 3 }}>
                  <AlertTitle>Instructions</AlertTitle>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="1. Click the link above or go to microsoft.com/devicelogin" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="2. Enter the code shown above" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="3. Sign in with your Global Administrator account" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="4. Approve the permissions requested" />
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
            
            {appConfig.apiMethod === 'smtp_oauth' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <AlertTitle>SMTP AUTH Required</AlertTitle>
                <Typography variant="body2">
                  SMTP OAuth2 requires SMTP AUTH to be enabled for each mailbox.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>To enable SMTP AUTH:</strong>
                </Typography>
                <Typography variant="body2" component="pre" sx={{ 
                  mt: 1, 
                  p: 1, 
                  bgcolor: theme => theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(0, 0, 0, 0.04)',
                  color: theme => theme.palette.mode === 'dark'
                    ? '#90caf9'
                    : '#1976d2',
                  border: theme => `1px solid ${theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.12)' 
                    : 'rgba(0, 0, 0, 0.12)'}`,
                  borderRadius: 1,
                  fontSize: '0.85rem',
                  fontFamily: 'monospace'
                }}>
{`Set-CASMailbox -Identity user@domain.com \\
  -SmtpClientAuthenticationDisabled $false`}
                </Typography>
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Note: Microsoft Graph API does not require SMTP AUTH.
                </Typography>
              </Alert>
            )}
            
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
              <Alert severity="success" sx={{ mt: 3 }}>
                <AlertTitle>Application Created Successfully!</AlertTitle>
                <Typography><strong>App ID:</strong> {appCreated.application.appId}</Typography>
                <Typography><strong>Tenant ID:</strong> {appCreated.application.tenantId}</Typography>
                {appCreated.clientSecret && (
                  <Typography variant="caption">Client secret saved to config.yml</Typography>
                )}
              </Alert>
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
      <Typography variant="h5" gutterBottom>
        Azure AD Automatic Setup
      </Typography>
      
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
        <Box>
          {activeStep > 0 && activeStep < 3 && !polling && (
            <Button 
              variant="contained"
              startIcon={<ArrowBackIcon />}
              onClick={() => setActiveStep(activeStep - 1)}
              sx={{ 
                borderRadius: 2,
                px: 2,
                py: 1,
                backgroundColor: '#9c27b0',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 500,
                textTransform: 'none',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#7b1fa2',
                  transform: 'translateX(-2px)'
                }
              }}
            >
              Back
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default SimpleAzureSetup;