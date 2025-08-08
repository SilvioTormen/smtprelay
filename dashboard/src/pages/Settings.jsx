import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  TextField,
  Alert,
  LinearProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Input
} from '@mui/material';
import {
  Security as SecurityIcon,
  CloudUpload as UploadIcon,
  GetApp as DownloadIcon,
  VpnKey as KeyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Settings as SystemIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import SystemConfig from '../components/SystemConfig';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Settings() {
  const [tabValue, setTabValue] = useState(0);
  const [certStatus, setCertStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [letsEncryptDialog, setLetsEncryptDialog] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // Certificate upload state
  const [certFile, setCertFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [chainFile, setChainFile] = useState(null);

  // Self-signed generation state
  const [selfSignedData, setSelfSignedData] = useState({
    commonName: '',
    country: '',
    state: '',
    locality: '',
    organization: '',
    days: 365
  });

  // Let's Encrypt state
  const [letsEncryptData, setLetsEncryptData] = useState({
    domain: '',
    email: '',
    staging: true
  });

  useEffect(() => {
    fetchCertificateStatus();
  }, []);

  const fetchCertificateStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/certificates/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCertStatus(data);
      } else {
        throw new Error('Failed to fetch certificate status');
      }
    } catch (error) {
      enqueueSnackbar(`Error: ${error.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCertUpload = async () => {
    if (!certFile || !keyFile) {
      enqueueSnackbar('Please select both certificate and private key files', { variant: 'warning' });
      return;
    }

    const formData = new FormData();
    formData.append('certificate', certFile);
    formData.append('privateKey', keyFile);
    if (chainFile) {
      formData.append('chain', chainFile);
    }

    setLoading(true);
    try {
      const response = await fetch('/api/certificates/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        enqueueSnackbar(data.message, { variant: 'success' });
        setUploadDialog(false);
        setCertFile(null);
        setKeyFile(null);
        setChainFile(null);
        fetchCertificateStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      enqueueSnackbar(`Upload failed: ${error.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSelfSigned = async () => {
    if (!selfSignedData.commonName) {
      enqueueSnackbar('Common Name is required', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/certificates/generate-self-signed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selfSignedData)
      });

      const data = await response.json();
      
      if (response.ok) {
        enqueueSnackbar(data.message, { variant: 'success' });
        setGenerateDialog(false);
        setSelfSignedData({
          commonName: '',
          country: '',
          state: '',
          locality: '',
          organization: '',
          days: 365
        });
        fetchCertificateStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      enqueueSnackbar(`Generation failed: ${error.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLetsEncrypt = async () => {
    if (!letsEncryptData.domain || !letsEncryptData.email) {
      enqueueSnackbar('Domain and email are required', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/certificates/generate-letsencrypt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(letsEncryptData)
      });

      const data = await response.json();
      
      if (response.ok) {
        enqueueSnackbar(data.message, { variant: 'success' });
        if (data.renewCommand) {
          enqueueSnackbar(`Add to crontab: ${data.renewCommand}`, { variant: 'info', persist: true });
        }
        setLetsEncryptDialog(false);
        setLetsEncryptData({
          domain: '',
          email: '',
          staging: true
        });
        fetchCertificateStatus();
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      enqueueSnackbar(`Let's Encrypt failed: ${error.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCert = async () => {
    window.open('/api/certificates/download/certificate', '_blank');
  };

  const getCertificateStatusColor = () => {
    if (!certStatus) return 'default';
    if (!certStatus.hasCertificate) return 'default';
    if (certStatus.daysUntilExpiry < 0) return 'error';
    if (certStatus.daysUntilExpiry < 30) return 'warning';
    return 'success';
  };

  const getCertificateStatusIcon = () => {
    if (!certStatus) return <InfoIcon />;
    if (!certStatus.hasCertificate) return <LockOpenIcon />;
    if (certStatus.daysUntilExpiry < 0) return <ErrorIcon />;
    if (certStatus.daysUntilExpiry < 30) return <WarningIcon />;
    return <CheckIcon />;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Paper elevation={3} sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="TLS Certificates" icon={<SecurityIcon />} />
          <Tab label="System Config" icon={<SystemIcon />} />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        {/* TLS Certificate Management */}
        <Grid container spacing={3}>
          {/* Certificate Status Card */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    {getCertificateStatusIcon()}
                    <Typography variant="h6" sx={{ ml: 1 }}>
                      Certificate Status
                    </Typography>
                  </Box>
                  <Tooltip title="Refresh">
                    <IconButton onClick={fetchCertificateStatus} size="small" color="primary">
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

                {loading && <LinearProgress sx={{ mb: 2 }} />}

                {certStatus && (
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Certificate" 
                        secondary={certStatus.hasCertificate ? 'Installed' : 'Not installed'}
                      />
                      <Chip 
                        size="small"
                        label={certStatus.hasCertificate ? 'Active' : 'Missing'}
                        color={certStatus.hasCertificate ? 'success' : 'default'}
                        variant={certStatus.hasCertificate ? 'filled' : 'outlined'}
                      />
                    </ListItem>

                    {certStatus.hasCertificate && (
                      <>
                        <ListItem>
                          <ListItemText 
                            primary="Subject" 
                            secondary={certStatus.subject || 'Unknown'}
                          />
                        </ListItem>
                        
                        <ListItem>
                          <ListItemText 
                            primary="Issuer" 
                            secondary={certStatus.issuer || 'Unknown'}
                          />
                          {certStatus.isSelfSigned && (
                            <Chip size="small" label="Self-Signed" color="warning" variant="outlined" />
                          )}
                        </ListItem>

                        <ListItem>
                          <ListItemText 
                            primary="Expiry" 
                            secondary={certStatus.expiryDate ? new Date(certStatus.expiryDate).toLocaleDateString() : 'Unknown'}
                          />
                          <Chip 
                            size="small"
                            label={`${certStatus.daysUntilExpiry} days`}
                            color={getCertificateStatusColor()}
                            variant="filled"
                          />
                        </ListItem>

                        {certStatus.alternativeNames && (
                          <ListItem>
                            <ListItemText 
                              primary="SANs" 
                              secondary={certStatus.alternativeNames.join(', ')}
                            />
                          </ListItem>
                        )}

                        {certStatus.fingerprint && (
                          <ListItem>
                            <ListItemText 
                              primary="SHA256 Fingerprint" 
                              secondary={
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                  {certStatus.fingerprint}
                                </Typography>
                              }
                            />
                          </ListItem>
                        )}
                      </>
                    )}
                  </List>
                )}
              </CardContent>
              
              {certStatus?.hasCertificate && (
                <CardActions>
                  <Button 
                    size="small" 
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadCert}
                  >
                    Download Certificate
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>

          {/* Certificate Actions Card */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Certificate Management
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => setUploadDialog(true)}
                    fullWidth
                    size="large"
                    sx={{ textTransform: 'none', py: 1.5 }}
                  >
                    Upload Certificate
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setGenerateDialog(true)}
                    fullWidth
                    size="large"
                    sx={{ textTransform: 'none', py: 1.5 }}
                  >
                    Generate Self-Signed
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<LockIcon />}
                    onClick={() => setLetsEncryptDialog(true)}
                    fullWidth
                    color="success"
                    size="large"
                    sx={{ textTransform: 'none', py: 1.5 }}
                  >
                    Generate Let's Encrypt
                  </Button>
                </Box>

                <Alert severity="info" sx={{ mt: 3 }} variant="outlined">
                  <Typography variant="body2">
                    <strong>Note:</strong> After changing certificates, restart the service:
                    <Box component="code" sx={{ display: 'block', mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace' }}>
                      sudo systemctl restart smtp-relay
                    </Box>
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Tips */}
          <Grid item xs={12}>
            <Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Always backup your certificates before making changes. 
                Certificate changes require a service restart to take effect.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Upload Certificate Dialog */}
      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload TLS Certificate</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                Certificate File (*.pem, *.crt) *
              </Typography>
              <Input
                type="file"
                onChange={(e) => setCertFile(e.target.files[0])}
                inputProps={{ accept: '.pem,.crt' }}
                fullWidth
              />
            </Box>

            <Box>
              <Typography variant="body2" gutterBottom>
                Private Key File (*.pem, *.key) *
              </Typography>
              <Input
                type="file"
                onChange={(e) => setKeyFile(e.target.files[0])}
                inputProps={{ accept: '.pem,.key' }}
                fullWidth
              />
            </Box>

            <Box>
              <Typography variant="body2" gutterBottom>
                Certificate Chain (optional)
              </Typography>
              <Input
                type="file"
                onChange={(e) => setChainFile(e.target.files[0])}
                inputProps={{ accept: '.pem' }}
                fullWidth
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCertUpload} 
            variant="contained"
            disabled={loading || !certFile || !keyFile}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Self-Signed Dialog */}
      <Dialog open={generateDialog} onClose={() => setGenerateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Self-Signed Certificate</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Common Name (CN) *"
              value={selfSignedData.commonName}
              onChange={(e) => setSelfSignedData({ ...selfSignedData, commonName: e.target.value })}
              fullWidth
              helperText="e.g., smtp-relay.yourdomain.com"
            />
            
            <TextField
              label="Country (C)"
              value={selfSignedData.country}
              onChange={(e) => setSelfSignedData({ ...selfSignedData, country: e.target.value })}
              fullWidth
              inputProps={{ maxLength: 2 }}
              helperText="Two-letter country code (e.g., US, DE, CH)"
            />
            
            <TextField
              label="State/Province (ST)"
              value={selfSignedData.state}
              onChange={(e) => setSelfSignedData({ ...selfSignedData, state: e.target.value })}
              fullWidth
            />
            
            <TextField
              label="Locality/City (L)"
              value={selfSignedData.locality}
              onChange={(e) => setSelfSignedData({ ...selfSignedData, locality: e.target.value })}
              fullWidth
            />
            
            <TextField
              label="Organization (O)"
              value={selfSignedData.organization}
              onChange={(e) => setSelfSignedData({ ...selfSignedData, organization: e.target.value })}
              fullWidth
            />
            
            <TextField
              label="Validity (Days)"
              type="number"
              value={selfSignedData.days}
              onChange={(e) => setSelfSignedData({ ...selfSignedData, days: parseInt(e.target.value) })}
              fullWidth
              helperText="How long the certificate should be valid"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleGenerateSelfSigned} 
            variant="contained"
            disabled={loading || !selfSignedData.commonName}
          >
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Let's Encrypt Dialog */}
      <Dialog open={letsEncryptDialog} onClose={() => setLetsEncryptDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Let's Encrypt Certificate</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Requires port 80 to be accessible from the internet for domain validation.
          </Alert>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Domain *"
              value={letsEncryptData.domain}
              onChange={(e) => setLetsEncryptData({ ...letsEncryptData, domain: e.target.value })}
              fullWidth
              helperText="Fully qualified domain name"
            />
            
            <TextField
              label="Email *"
              type="email"
              value={letsEncryptData.email}
              onChange={(e) => setLetsEncryptData({ ...letsEncryptData, email: e.target.value })}
              fullWidth
              helperText="For renewal notifications"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={letsEncryptData.staging}
                  onChange={(e) => setLetsEncryptData({ ...letsEncryptData, staging: e.target.checked })}
                />
              }
              label="Use Staging (Test) Environment"
            />
            
            {!letsEncryptData.staging && (
              <Alert severity="warning">
                Production certificates have rate limits. Use staging for testing.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLetsEncryptDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleGenerateLetsEncrypt} 
            variant="contained"
            color="success"
            disabled={loading || !letsEncryptData.domain || !letsEncryptData.email}
          >
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* System Config Tab Panel */}
      <TabPanel value={tabValue} index={1}>
        <SystemConfig />
      </TabPanel>
    </Box>
  );
}