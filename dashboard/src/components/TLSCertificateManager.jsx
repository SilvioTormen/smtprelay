import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Tooltip,
  Divider,
  Badge,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Collapse,
  CircularProgress,
  useTheme,
  alpha,
  Input,
  InputAdornment,
  Menu,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Fade,
  Grow,
  Zoom
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import { motion, AnimatePresence } from 'framer-motion';
import { useSnackbar } from 'notistack';
import {
  Security as SecurityIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  CloudUpload as UploadIcon,
  CloudDownload as DownloadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  VpnKey as KeyIcon,
  VerifiedUser as VerifiedIcon,
  Shield as ShieldIcon,
  AutoAwesome as AutoAwesomeIcon,
  Build as BuildIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  HighlightOff as HighlightOffIcon,
  AccessTime as AccessTimeIcon,
  DomainVerification as DomainIcon,
  Fingerprint as FingerprintIcon,
  Assignment as AssignmentIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CloudSync as CloudSyncIcon,
  History as HistoryIcon,
  NotificationImportant as NotificationIcon,
  AutorenewOutlined as AutoRenewIcon,
  SettingsSuggest as SettingsSuggestIcon,
  ArrowForward as ArrowForwardIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  LocalFireDepartment as FireIcon,
  AcUnit as SnowIcon
} from '@mui/icons-material';

const MotionCard = motion(Card);
const MotionBox = motion(Box);

const TLSCertificateManager = () => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  
  const [loading, setLoading] = useState(false);
  const [certStatus, setCertStatus] = useState(null);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [letsEncryptDialog, setLetsEncryptDialog] = useState(false);
  const [certDetailsExpanded, setCertDetailsExpanded] = useState(true);
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(false);
  const [certHistory, setCertHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  
  // File states
  const [certFile, setCertFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [chainFile, setChainFile] = useState(null);
  
  // Self-signed form data
  const [selfSignedData, setSelfSignedData] = useState({
    commonName: '',
    country: '',
    state: '',
    locality: '',
    organization: '',
    organizationalUnit: '',
    emailAddress: '',
    days: 365,
    keySize: 2048,
    alternativeNames: []
  });
  
  // Let's Encrypt form data
  const [letsEncryptData, setLetsEncryptData] = useState({
    domain: '',
    email: '',
    staging: true,
    autoRenew: true,
    dnsChallenge: false,
    webroot: '/var/www/html'
  });

  useEffect(() => {
    fetchCertificateStatus();
    fetchCertHistory();
  }, []);

  const fetchCertificateStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/certificates/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setCertStatus(data);
      setAutoRenewEnabled(data.autoRenewEnabled || false);
    } catch (error) {
      enqueueSnackbar('Failed to fetch certificate status', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCertHistory = async () => {
    try {
      const response = await fetch('/api/certificates/history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setCertHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch certificate history');
    }
  };

  const handleCertUpload = async () => {
    if (!certFile || !keyFile) {
      enqueueSnackbar('Certificate and key files are required', { variant: 'warning' });
      return;
    }

    const formData = new FormData();
    formData.append('certificate', certFile);
    formData.append('key', keyFile);
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
        enqueueSnackbar('Certificate uploaded successfully', { variant: 'success' });
        setUploadDialog(false);
        setCertFile(null);
        setKeyFile(null);
        setChainFile(null);
        fetchCertificateStatus();
        fetchCertHistory();
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
        enqueueSnackbar('Self-signed certificate generated successfully', { variant: 'success' });
        setGenerateDialog(false);
        setSelfSignedData({
          commonName: '',
          country: '',
          state: '',
          locality: '',
          organization: '',
          organizationalUnit: '',
          emailAddress: '',
          days: 365,
          keySize: 2048,
          alternativeNames: []
        });
        fetchCertificateStatus();
        fetchCertHistory();
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
          enqueueSnackbar(`Auto-renewal configured`, { variant: 'info' });
        }
        setLetsEncryptDialog(false);
        setLetsEncryptData({
          domain: '',
          email: '',
          staging: true,
          autoRenew: true,
          dnsChallenge: false,
          webroot: '/var/www/html'
        });
        fetchCertificateStatus();
        fetchCertHistory();
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      enqueueSnackbar(`Let's Encrypt failed: ${error.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoRenewToggle = async () => {
    try {
      const response = await fetch('/api/certificates/auto-renew', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !autoRenewEnabled })
      });

      if (response.ok) {
        setAutoRenewEnabled(!autoRenewEnabled);
        enqueueSnackbar(
          `Auto-renewal ${!autoRenewEnabled ? 'enabled' : 'disabled'}`, 
          { variant: 'success' }
        );
      }
    } catch (error) {
      enqueueSnackbar('Failed to update auto-renewal', { variant: 'error' });
    }
  };

  const getCertificateHealth = () => {
    if (!certStatus?.hasCertificate) return { status: 'missing', color: 'default', icon: <LockOpenIcon /> };
    if (certStatus.daysUntilExpiry < 0) return { status: 'expired', color: 'error', icon: <ErrorIcon /> };
    if (certStatus.daysUntilExpiry < 7) return { status: 'critical', color: 'error', icon: <FireIcon /> };
    if (certStatus.daysUntilExpiry < 30) return { status: 'warning', color: 'warning', icon: <WarningIcon /> };
    if (certStatus.daysUntilExpiry < 60) return { status: 'attention', color: 'info', icon: <InfoIcon /> };
    return { status: 'healthy', color: 'success', icon: <CheckIcon /> };
  };

  const health = getCertificateHealth();

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'success' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Main Status Card with Animation */}
      <MotionCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        elevation={3}
        sx={{
          mb: 3,
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.1)} 0%, ${alpha(theme.palette.secondary.dark, 0.1)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.1)} 100%)`,
          borderRadius: 3,
          overflow: 'visible'
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Box display="flex" alignItems="center" mb={3}>
                <Badge
                  badgeContent={health.status === 'healthy' ? <CheckIcon fontSize="small" /> : null}
                  color={health.color}
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: theme.palette.mode === 'dark'
                        ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`
                        : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      color: 'white',
                      mr: 2
                    }}
                  >
                    {health.icon}
                  </Box>
                </Badge>
                <Box flex={1}>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    TLS Certificate Status
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={certStatus?.hasCertificate ? 'Certificate Installed' : 'No Certificate'}
                      color={health.color}
                      size="small"
                      icon={certStatus?.hasCertificate ? <LockIcon /> : <LockOpenIcon />}
                    />
                    {certStatus?.isSelfSigned && (
                      <Chip
                        label="Self-Signed"
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {certStatus?.isLetsEncrypt && (
                      <Chip
                        label="Let's Encrypt"
                        color="success"
                        size="small"
                        icon={<VerifiedIcon />}
                      />
                    )}
                  </Box>
                </Box>
                <Tooltip title="Refresh Status">
                  <IconButton 
                    onClick={fetchCertificateStatus}
                    disabled={loading}
                    sx={{ 
                      background: alpha(theme.palette.primary.main, 0.1),
                      '&:hover': { background: alpha(theme.palette.primary.main, 0.2) }
                    }}
                  >
                    {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
                  </IconButton>
                </Tooltip>
              </Box>

              {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

              {certStatus?.hasCertificate && (
                <AnimatePresence>
                  <MotionBox
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.paper, 0.8) }}>
                          <Box display="flex" alignItems="center" mb={1}>
                            <DomainIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="subtitle2" color="textSecondary">
                              Common Name
                            </Typography>
                          </Box>
                          <Typography variant="body1" fontWeight="medium">
                            {certStatus.subject || 'Unknown'}
                          </Typography>
                        </Paper>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.paper, 0.8) }}>
                          <Box display="flex" alignItems="center" mb={1}>
                            <VerifiedIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="subtitle2" color="textSecondary">
                              Issuer
                            </Typography>
                          </Box>
                          <Typography variant="body1" fontWeight="medium">
                            {certStatus.issuer || 'Unknown'}
                          </Typography>
                        </Paper>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.paper, 0.8) }}>
                          <Box display="flex" alignItems="center" mb={1}>
                            <EventIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="subtitle2" color="textSecondary">
                              Valid From
                            </Typography>
                          </Box>
                          <Typography variant="body1" fontWeight="medium">
                            {formatDate(certStatus.validFrom)}
                          </Typography>
                        </Paper>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Paper sx={{ 
                          p: 2, 
                          borderRadius: 2, 
                          bgcolor: alpha(theme.palette.background.paper, 0.8),
                          border: health.status !== 'healthy' ? `2px solid ${theme.palette[health.color].main}` : 'none'
                        }}>
                          <Box display="flex" alignItems="center" mb={1}>
                            <ScheduleIcon sx={{ mr: 1, color: health.color === 'default' ? 'primary.main' : `${health.color}.main` }} />
                            <Typography variant="subtitle2" color="textSecondary">
                              Expires
                            </Typography>
                          </Box>
                          <Typography variant="body1" fontWeight="medium">
                            {formatDate(certStatus.validTo)}
                          </Typography>
                          <Typography variant="caption" color={`${health.color}.main`}>
                            {certStatus.daysUntilExpiry > 0 
                              ? `${certStatus.daysUntilExpiry} days remaining`
                              : 'Expired'}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* Advanced Details Accordion */}
                    <Accordion 
                      expanded={certDetailsExpanded}
                      onChange={() => setCertDetailsExpanded(!certDetailsExpanded)}
                      sx={{ mt: 2, borderRadius: 2, '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Advanced Certificate Details</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <List dense>
                              <ListItem>
                                <ListItemIcon><FingerprintIcon /></ListItemIcon>
                                <ListItemText 
                                  primary="Serial Number"
                                  secondary={certStatus.serialNumber || 'N/A'}
                                />
                                <ListItemSecondaryAction>
                                  <IconButton size="small" onClick={() => copyToClipboard(certStatus.serialNumber)}>
                                    <CopyIcon fontSize="small" />
                                  </IconButton>
                                </ListItemSecondaryAction>
                              </ListItem>
                              <ListItem>
                                <ListItemIcon><KeyIcon /></ListItemIcon>
                                <ListItemText 
                                  primary="Signature Algorithm"
                                  secondary={certStatus.signatureAlgorithm || 'N/A'}
                                />
                              </ListItem>
                              <ListItem>
                                <ListItemIcon><ShieldIcon /></ListItemIcon>
                                <ListItemText 
                                  primary="Key Size"
                                  secondary={`${certStatus.keySize || 'Unknown'} bits`}
                                />
                              </ListItem>
                            </List>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <List dense>
                              <ListItem>
                                <ListItemIcon><DomainIcon /></ListItemIcon>
                                <ListItemText 
                                  primary="Alternative Names"
                                  secondary={certStatus.altNames?.join(', ') || 'None'}
                                />
                              </ListItem>
                              <ListItem>
                                <ListItemIcon><SecurityIcon /></ListItemIcon>
                                <ListItemText 
                                  primary="Fingerprint (SHA-256)"
                                  secondary={
                                    <Box display="flex" alignItems="center">
                                      <Typography 
                                        variant="caption" 
                                        sx={{ 
                                          fontFamily: 'monospace',
                                          display: showFingerprint ? 'block' : 'none'
                                        }}
                                      >
                                        {certStatus.fingerprint}
                                      </Typography>
                                      {!showFingerprint && (
                                        <Typography variant="caption">
                                          ••••••••••••••••
                                        </Typography>
                                      )}
                                      <IconButton 
                                        size="small" 
                                        onClick={() => setShowFingerprint(!showFingerprint)}
                                        sx={{ ml: 1 }}
                                      >
                                        {showFingerprint ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                      </IconButton>
                                    </Box>
                                  }
                                />
                              </ListItem>
                            </List>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  </MotionBox>
                </AnimatePresence>
              )}

              {!certStatus?.hasCertificate && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  <AlertTitle>No Certificate Installed</AlertTitle>
                  Your SMTP relay is running without TLS encryption. Upload or generate a certificate to secure email communications.
                </Alert>
              )}
            </Grid>

            {/* Quick Actions Panel */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<CloudSyncIcon />}
                    onClick={() => setLetsEncryptDialog(true)}
                    sx={{
                      background: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
                      color: 'black',
                      fontWeight: 'bold'
                    }}
                  >
                    Get Let's Encrypt Cert
                  </Button>
                  
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={() => setUploadDialog(true)}
                  >
                    Upload Certificate
                  </Button>
                  
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<BuildIcon />}
                    onClick={() => setGenerateDialog(true)}
                  >
                    Generate Self-Signed
                  </Button>
                  
                  {certStatus?.hasCertificate && (
                    <>
                      <Divider />
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => window.open('/api/certificates/download/certificate', '_blank')}
                      >
                        Download Certificate
                      </Button>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={autoRenewEnabled}
                            onChange={handleAutoRenewToggle}
                            color="primary"
                          />
                        }
                        label={
                          <Box display="flex" alignItems="center">
                            <AutoRenewIcon sx={{ mr: 1 }} />
                            Auto-Renewal
                          </Box>
                        }
                      />
                    </>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </MotionCard>

      {/* Certificate History Timeline */}
      {certHistory.length > 0 && (
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          elevation={3}
          sx={{ mb: 3, borderRadius: 3 }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Certificate History</Typography>
              <IconButton onClick={() => setShowHistory(!showHistory)}>
                <HistoryIcon />
              </IconButton>
            </Box>
            
            <Collapse in={showHistory}>
              <Timeline position="alternate">
                {certHistory.slice(0, 5).map((event, index) => (
                  <TimelineItem key={index}>
                    <TimelineOppositeContent color="textSecondary">
                      {formatDate(event.date)}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color={event.type === 'installed' ? 'success' : 'warning'}>
                        {event.type === 'installed' ? <CheckIcon /> : <WarningIcon />}
                      </TimelineDot>
                      {index < certHistory.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="subtitle2">{event.action}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {event.details}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </Collapse>
          </CardContent>
        </MotionCard>
      )}

      {/* Upload Certificate Dialog */}
      <Dialog 
        open={uploadDialog} 
        onClose={() => setUploadDialog(false)} 
        maxWidth="sm" 
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <UploadIcon sx={{ mr: 1 }} />
            Upload TLS Certificate
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Certificate File (.pem, .crt) *
              </Typography>
              <Input
                type="file"
                onChange={(e) => setCertFile(e.target.files[0])}
                inputProps={{ accept: '.pem,.crt' }}
                fullWidth
              />
            </Box>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Private Key File (.pem, .key) *
              </Typography>
              <Input
                type="file"
                onChange={(e) => setKeyFile(e.target.files[0])}
                inputProps={{ accept: '.pem,.key' }}
                fullWidth
              />
            </Box>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Certificate Chain (optional)
              </Typography>
              <Input
                type="file"
                onChange={(e) => setChainFile(e.target.files[0])}
                inputProps={{ accept: '.pem' }}
                fullWidth
              />
            </Box>
            
            <Alert severity="info">
              Files will be validated before installation. Ensure your private key matches the certificate.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCertUpload} 
            variant="contained"
            disabled={loading || !certFile || !keyFile}
            startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            Upload & Install
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Self-Signed Dialog with Stepper */}
      <Dialog 
        open={generateDialog} 
        onClose={() => setGenerateDialog(false)} 
        maxWidth="md" 
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <BuildIcon sx={{ mr: 1 }} />
            Generate Self-Signed Certificate
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 2 }}>
            <Step>
              <StepLabel>Basic Information</StepLabel>
              <StepContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Common Name (CN) *"
                      value={selfSignedData.commonName}
                      onChange={(e) => setSelfSignedData({ ...selfSignedData, commonName: e.target.value })}
                      fullWidth
                      helperText="e.g., smtp-relay.yourdomain.com"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Country (C)"
                      value={selfSignedData.country}
                      onChange={(e) => setSelfSignedData({ ...selfSignedData, country: e.target.value })}
                      fullWidth
                      inputProps={{ maxLength: 2 }}
                      helperText="Two-letter code (US, DE, CH)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="State/Province (ST)"
                      value={selfSignedData.state}
                      onChange={(e) => setSelfSignedData({ ...selfSignedData, state: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <Button onClick={() => setActiveStep(1)} variant="contained">
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>
            
            <Step>
              <StepLabel>Organization Details</StepLabel>
              <StepContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Organization (O)"
                      value={selfSignedData.organization}
                      onChange={(e) => setSelfSignedData({ ...selfSignedData, organization: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Organizational Unit (OU)"
                      value={selfSignedData.organizationalUnit}
                      onChange={(e) => setSelfSignedData({ ...selfSignedData, organizationalUnit: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Email Address"
                      type="email"
                      value={selfSignedData.emailAddress}
                      onChange={(e) => setSelfSignedData({ ...selfSignedData, emailAddress: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Box mt={2} display="flex" gap={1}>
                  <Button onClick={() => setActiveStep(0)}>Back</Button>
                  <Button onClick={() => setActiveStep(2)} variant="contained">
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>
            
            <Step>
              <StepLabel>Certificate Options</StepLabel>
              <StepContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Validity (Days)"
                      type="number"
                      value={selfSignedData.days}
                      onChange={(e) => setSelfSignedData({ ...selfSignedData, days: parseInt(e.target.value) })}
                      fullWidth
                      helperText="Recommended: 365 days"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Key Size</InputLabel>
                      <Select
                        value={selfSignedData.keySize}
                        onChange={(e) => setSelfSignedData({ ...selfSignedData, keySize: e.target.value })}
                        label="Key Size"
                      >
                        <MenuItem value={2048}>2048 bits (Recommended)</MenuItem>
                        <MenuItem value={4096}>4096 bits (More Secure)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Box mt={2} display="flex" gap={1}>
                  <Button onClick={() => setActiveStep(1)}>Back</Button>
                  <Button 
                    onClick={handleGenerateSelfSigned} 
                    variant="contained"
                    disabled={loading || !selfSignedData.commonName}
                    startIcon={loading ? <CircularProgress size={20} /> : <BuildIcon />}
                  >
                    Generate Certificate
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
      </Dialog>

      {/* Let's Encrypt Dialog */}
      <Dialog 
        open={letsEncryptDialog} 
        onClose={() => setLetsEncryptDialog(false)} 
        maxWidth="sm" 
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <CloudSyncIcon sx={{ mr: 1, color: 'success.main' }} />
            Generate Let's Encrypt Certificate
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Free, automated TLS certificate from Let's Encrypt Certificate Authority.
          </Alert>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Domain *"
              value={letsEncryptData.domain}
              onChange={(e) => setLetsEncryptData({ ...letsEncryptData, domain: e.target.value })}
              fullWidth
              helperText="Fully qualified domain name (must be publicly accessible)"
            />
            
            <TextField
              label="Email *"
              type="email"
              value={letsEncryptData.email}
              onChange={(e) => setLetsEncryptData({ ...letsEncryptData, email: e.target.value })}
              fullWidth
              helperText="For renewal notifications and account recovery"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={letsEncryptData.dnsChallenge}
                  onChange={(e) => setLetsEncryptData({ ...letsEncryptData, dnsChallenge: e.target.checked })}
                />
              }
              label="Use DNS Challenge (for wildcard certificates)"
            />
            
            {!letsEncryptData.dnsChallenge && (
              <TextField
                label="Webroot Path"
                value={letsEncryptData.webroot}
                onChange={(e) => setLetsEncryptData({ ...letsEncryptData, webroot: e.target.value })}
                fullWidth
                helperText="Path for HTTP-01 challenge files"
              />
            )}
            
            <FormControlLabel
              control={
                <Switch
                  checked={letsEncryptData.autoRenew}
                  onChange={(e) => setLetsEncryptData({ ...letsEncryptData, autoRenew: e.target.checked })}
                  color="primary"
                />
              }
              label="Enable Auto-Renewal (Recommended)"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={letsEncryptData.staging}
                  onChange={(e) => setLetsEncryptData({ ...letsEncryptData, staging: e.target.checked })}
                />
              }
              label="Use Staging Environment (for testing)"
            />
            
            {!letsEncryptData.staging && (
              <Alert severity="warning">
                Production certificates have rate limits. Use staging for testing first.
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
            startIcon={loading ? <CircularProgress size={20} /> : <CloudSyncIcon />}
          >
            Generate Certificate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TLSCertificateManager;