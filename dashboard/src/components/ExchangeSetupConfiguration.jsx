import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Chip,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Tooltip,
  FormHelperText
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  CloudUpload as CloudIcon,
  Key as KeyIcon,
  Timer as TimerIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const ExchangeSetupConfiguration = ({ config, onChange, mode = 'setup' }) => {
  const [expanded, setExpanded] = useState('general');

  const handleChange = (field, value) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  const handleNestedChange = (parent, field, value) => {
    onChange({
      ...config,
      [parent]: {
        ...config[parent],
        [field]: value
      }
    });
  };

  return (
    <Box>
      {/* Setup Mode Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Configuration Mode
        </Typography>
        <FormControl component="fieldset">
          <RadioGroup
            value={config.setupMode || 'guided'}
            onChange={(e) => handleChange('setupMode', e.target.value)}
          >
            <FormControlLabel 
              value="guided" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="body1">Guided Setup (Recommended)</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Automatic configuration with recommended settings
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel 
              value="advanced" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="body1">Advanced Configuration</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Full control over all settings and options
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </Paper>

      {/* Application Settings */}
      <Accordion 
        expanded={expanded === 'general'} 
        onChange={() => setExpanded(expanded === 'general' ? false : 'general')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ width: '33%', flexShrink: 0 }}>
            Application Settings
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Basic Azure AD application configuration
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Application Setup</FormLabel>
                <RadioGroup
                  value={config.createNewApp ? 'new' : 'existing'}
                  onChange={(e) => handleChange('createNewApp', e.target.value === 'new')}
                >
                  <FormControlLabel 
                    value="new" 
                    control={<Radio />} 
                    label="Create new Azure AD application"
                  />
                  <FormControlLabel 
                    value="existing" 
                    control={<Radio />} 
                    label="Use existing application"
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {config.createNewApp ? (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Application Display Name"
                    value={config.displayName || 'SMTP Relay for Exchange Online'}
                    onChange={(e) => handleChange('displayName', e.target.value)}
                    helperText="Visible name in Azure AD"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Application ID URI"
                    value={config.appName || `smtp-relay-${Date.now()}`}
                    onChange={(e) => handleChange('appName', e.target.value)}
                    helperText="Unique identifier for your app"
                  />
                </Grid>
              </>
            ) : (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Existing Application (Client) ID"
                  value={config.existingAppId || ''}
                  onChange={(e) => handleChange('existingAppId', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  helperText="Enter the Application (client) ID from Azure AD"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tenant ID"
                value={config.tenantId || ''}
                onChange={(e) => handleChange('tenantId', e.target.value)}
                placeholder="contoso.onmicrosoft.com or xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                helperText="Your Azure AD tenant identifier"
                required
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Authentication Settings */}
      <Accordion 
        expanded={expanded === 'auth'} 
        onChange={() => setExpanded(expanded === 'auth' ? false : 'auth')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ width: '33%', flexShrink: 0 }}>
            Authentication Method
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            How the SMTP relay authenticates with Exchange Online
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <KeyIcon color="primary" />
                  <Typography variant="subtitle2" fontWeight="medium">
                    Authentication Method
                  </Typography>
                </Box>
                <Typography variant="body1" gutterBottom>
                  Device Code Flow
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Interactive authentication with user accounts. Users will authenticate through a browser
                  using their Microsoft account credentials.
                </Typography>
              </Paper>
            </Grid>


            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>API Method</InputLabel>
                <Select
                  value={config.apiMethod || 'graph_api'}
                  onChange={(e) => handleChange('apiMethod', e.target.value)}
                  label="API Method"
                >
                  <MenuItem value="graph_api">Microsoft Graph API</MenuItem>
                  <MenuItem value="smtp_oauth">SMTP OAuth2</MenuItem>
                </Select>
                <FormHelperText>
                  Graph API provides better monitoring and features
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Permissions Settings */}
      <Accordion 
        expanded={expanded === 'permissions'} 
        onChange={() => setExpanded(expanded === 'permissions' ? false : 'permissions')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ width: '33%', flexShrink: 0 }}>
            Permissions
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            API permissions required for the application
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Required Permissions</AlertTitle>
                These permissions will be requested based on your authentication method
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Delegated Permissions (User Context)
              </Typography>
              <List dense>
                <ListItem>
                  <Checkbox checked disabled />
                  <ListItemText 
                    primary="User.Read"
                    secondary="Sign in and read user profile"
                  />
                </ListItem>
                <ListItem>
                  <Checkbox checked disabled />
                  <ListItemText 
                    primary="Mail.Send"
                    secondary="Send mail as the signed-in user"
                  />
                </ListItem>
              </List>
            </Grid>


            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.autoConsent !== false}
                    onChange={(e) => handleChange('autoConsent', e.target.checked)}
                  />
                }
                label="Automatically grant admin consent during setup"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Advanced Settings */}
      {config.setupMode === 'advanced' && (
        <Accordion 
          expanded={expanded === 'advanced'} 
          onChange={() => setExpanded(expanded === 'advanced' ? false : 'advanced')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ width: '33%', flexShrink: 0 }}>
              Advanced Settings
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              Additional configuration options
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Redirect URIs
                </Typography>
                <List dense>
                  {(config.redirectUris || ['http://localhost:3001/auth/callback']).map((uri, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={uri} />
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          size="small"
                          onClick={() => {
                            const newUris = [...(config.redirectUris || [])];
                            newUris.splice(index, 1);
                            handleChange('redirectUris', newUris);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const newUri = prompt('Enter redirect URI:');
                    if (newUri) {
                      handleChange('redirectUris', [...(config.redirectUris || []), newUri]);
                    }
                  }}
                >
                  Add Redirect URI
                </Button>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableLogging || false}
                      onChange={(e) => handleChange('enableLogging', e.target.checked)}
                    />
                  }
                  label="Enable detailed logging for troubleshooting"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.skipValidation || false}
                      onChange={(e) => handleChange('skipValidation', e.target.checked)}
                    />
                  }
                  label="Skip validation checks (advanced users only)"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Summary */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>
          Configuration Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="textSecondary">Setup Mode</Typography>
            <Typography variant="body2">{config.setupMode === 'advanced' ? 'Advanced' : 'Guided'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="textSecondary">Authentication</Typography>
            <Typography variant="body2">
              Device Code Flow
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="textSecondary">API Method</Typography>
            <Typography variant="body2">
              {config.apiMethod === 'smtp_oauth' ? 'SMTP OAuth2' : 'Microsoft Graph'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ExchangeSetupConfiguration;