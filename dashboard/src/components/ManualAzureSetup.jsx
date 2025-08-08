import React, { useState } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link,
  Divider,
  Chip
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';

const ManualAzureSetup = ({ onComplete, onCancel }) => {
  const { apiRequest } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Configuration data
  const [config, setConfig] = useState({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    authMethod: 'device_code',
    apiMethod: 'graph_api'
  });
  
  const steps = ['Choose Auth Method', 'Azure Portal Setup', 'Enter Credentials', 'Save Configuration'];
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };
  
  const saveConfiguration = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/azure-simple/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Configuration saved successfully!');
        setTimeout(() => {
          onComplete(data);
        }, 2000);
      } else {
        setError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Choose Auth Method
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose Authentication Method
            </Typography>
            
            <Card 
              sx={{ 
                mt: 2, 
                cursor: 'pointer',
                border: config.authMethod === 'device_code' ? '2px solid' : '1px solid',
                borderColor: config.authMethod === 'device_code' ? 'primary.main' : 'divider'
              }}
              onClick={() => setConfig({ ...config, authMethod: 'device_code' })}
            >
              <CardContent>
                <Typography variant="h6" color="primary">
                  Device Code Flow (Recommended)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  • Users authenticate with their own account
                  • Each user needs to authenticate individually
                  • More secure - no shared credentials
                  • Perfect for multi-user environments
                </Typography>
                <Chip label="User Context" color="success" size="small" sx={{ mt: 1 }} />
              </CardContent>
            </Card>
            
            <Card 
              sx={{ 
                mt: 2, 
                cursor: 'pointer',
                border: config.authMethod === 'client_credentials' ? '2px solid' : '1px solid',
                borderColor: config.authMethod === 'client_credentials' ? 'primary.main' : 'divider'
              }}
              onClick={() => setConfig({ ...config, authMethod: 'client_credentials' })}
            >
              <CardContent>
                <Typography variant="h6" color="primary">
                  Client Credentials Flow
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  • App authenticates without user interaction
                  • Can send emails as any user in the organization
                  • Requires admin consent
                  • Good for automated services
                </Typography>
                <Chip label="App-Only" color="warning" size="small" sx={{ mt: 1 }} />
              </CardContent>
            </Card>
            
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              onClick={() => setActiveStep(1)}
            >
              Continue with {config.authMethod === 'device_code' ? 'Device Code' : 'Client Credentials'}
            </Button>
          </Box>
        );
        
      case 1: // Azure Portal Setup
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Create Azure AD Application
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>Manual Setup Required</AlertTitle>
              Due to Microsoft security restrictions, you need to create the app manually in Azure Portal.
            </Alert>
            
            <Button
              variant="contained"
              startIcon={<OpenIcon />}
              href="https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps"
              target="_blank"
              fullWidth
              sx={{ mb: 3 }}
            >
              Open Azure Portal - App Registrations
            </Button>
            
            <Typography variant="subtitle1" gutterBottom>
              Follow these steps:
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon><Typography>1.</Typography></ListItemIcon>
                <ListItemText 
                  primary="Click 'New registration'"
                  secondary="In the Azure Portal App registrations page"
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon><Typography>2.</Typography></ListItemIcon>
                <ListItemText 
                  primary="Basic Settings"
                  secondary={
                    <Box>
                      <Typography variant="body2">• Name: SMTP Relay for Exchange Online</Typography>
                      <Typography variant="body2">• Account types: Accounts in this organizational directory only</Typography>
                    </Box>
                  }
                />
              </ListItem>
              
              {config.authMethod === 'device_code' ? (
                <>
                  <ListItem>
                    <ListItemIcon><Typography>3.</Typography></ListItemIcon>
                    <ListItemText 
                      primary="Redirect URI"
                      secondary={
                        <Box>
                          <Typography variant="body2">• Platform: Mobile and desktop applications</Typography>
                          <Typography variant="body2">• URI: https://login.microsoftonline.com/common/oauth2/nativeclient</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon><Typography>4.</Typography></ListItemIcon>
                    <ListItemText 
                      primary="API Permissions"
                      secondary={
                        <Box>
                          <Typography variant="body2">Add permission → Microsoft Graph → Delegated:</Typography>
                          <Typography variant="body2">• Mail.Send</Typography>
                          <Typography variant="body2">• User.Read</Typography>
                          <Typography variant="body2">• offline_access</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon><Typography>5.</Typography></ListItemIcon>
                    <ListItemText 
                      primary="Enable Public Client"
                      secondary={
                        <Box>
                          <Typography variant="body2">Authentication → Advanced settings</Typography>
                          <Typography variant="body2">• Allow public client flows: Yes</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </>
              ) : (
                <>
                  <ListItem>
                    <ListItemIcon><Typography>3.</Typography></ListItemIcon>
                    <ListItemText 
                      primary="Skip Redirect URI"
                      secondary="Not needed for client credentials"
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon><Typography>4.</Typography></ListItemIcon>
                    <ListItemText 
                      primary="API Permissions"
                      secondary={
                        <Box>
                          <Typography variant="body2">Add permission → Microsoft Graph → Application:</Typography>
                          <Typography variant="body2">• Mail.Send</Typography>
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            Don't forget to click "Grant admin consent"!
                          </Alert>
                        </Box>
                      }
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon><Typography>5.</Typography></ListItemIcon>
                    <ListItemText 
                      primary="Create Client Secret"
                      secondary={
                        <Box>
                          <Typography variant="body2">Certificates & secrets → New client secret</Typography>
                          <Typography variant="body2">• Description: SMTP Relay Secret</Typography>
                          <Typography variant="body2">• Expires: Max 2 years (Microsoft limit)</Typography>
                          <Alert severity="error" sx={{ mt: 1 }}>
                            Copy the secret immediately - it won't be shown again!
                          </Alert>
                        </Box>
                      }
                    />
                  </ListItem>
                </>
              )}
              
              <ListItem>
                <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Copy Application ID"
                  secondary="From the Overview page, copy the Application (client) ID"
                />
              </ListItem>
            </List>
            
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => setActiveStep(2)}
            >
              I've Created the App - Continue
            </Button>
          </Box>
        );
        
      case 2: // Enter Credentials
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Enter Azure AD Application Details
            </Typography>
            
            <TextField
              fullWidth
              label="Tenant ID"
              value={config.tenantId}
              onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              margin="normal"
              required
              helperText="Your Azure AD tenant ID (from Azure Portal → Overview)"
            />
            
            <TextField
              fullWidth
              label="Application (Client) ID"
              value={config.clientId}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              margin="normal"
              required
              helperText="The Application ID you copied from Azure Portal"
            />
            
            {config.authMethod === 'client_credentials' && (
              <TextField
                fullWidth
                label="Client Secret"
                type="password"
                value={config.clientSecret}
                onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                margin="normal"
                required
                helperText="The secret value you copied (not the secret ID)"
              />
            )}
            
            <FormControl fullWidth margin="normal">
              <InputLabel>API Method</InputLabel>
              <Select
                value={config.apiMethod}
                onChange={(e) => setConfig({ ...config, apiMethod: e.target.value })}
                label="API Method"
              >
                <MenuItem value="graph_api">Microsoft Graph API (Recommended)</MenuItem>
                <MenuItem value="smtp_oauth">SMTP OAuth2</MenuItem>
              </Select>
            </FormControl>
            
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              onClick={() => setActiveStep(3)}
              disabled={!config.tenantId || !config.clientId || 
                       (config.authMethod === 'client_credentials' && !config.clientSecret)}
            >
              Review Configuration
            </Button>
          </Box>
        );
        
      case 3: // Save Configuration
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Save Configuration
            </Typography>
            
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Authentication Method"
                      secondary={config.authMethod === 'device_code' ? 'Device Code Flow' : 'Client Credentials'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Tenant ID"
                      secondary={config.tenantId}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Client ID"
                      secondary={config.clientId}
                    />
                  </ListItem>
                  {config.clientSecret && (
                    <ListItem>
                      <ListItemText 
                        primary="Client Secret"
                        secondary="••••••••••••••••"
                      />
                    </ListItem>
                  )}
                  <ListItem>
                    <ListItemText 
                      primary="API Method"
                      secondary={config.apiMethod === 'graph_api' ? 'Microsoft Graph' : 'SMTP OAuth2'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
            
            <Alert severity="info" sx={{ mt: 2 }}>
              This configuration will be saved to config.yml and used for Exchange Online authentication.
            </Alert>
            
            <Button
              variant="contained"
              color="success"
              fullWidth
              sx={{ mt: 3 }}
              onClick={saveConfiguration}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Azure AD Manual Setup
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
        <Button onClick={onCancel}>
          Cancel
        </Button>
        {activeStep > 0 && activeStep < 3 && (
          <Button onClick={() => setActiveStep(activeStep - 1)}>
            Back
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default ManualAzureSetup;