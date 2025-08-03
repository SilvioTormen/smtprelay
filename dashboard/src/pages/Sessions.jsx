import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  AlertTitle,
  LinearProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Computer as MonitorIcon,
  Smartphone as SmartphoneIcon,
  Public as GlobeIcon,
  AccessTime as ClockIcon,
  Warning as AlertTriangleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as XCircleIcon,
  Logout as LogOutIcon,
  VpnKey as KeyIcon,
  Refresh as RefreshCwIcon,
  LocationOn as MapPinIcon,
  ShowChart as ActivityIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext-Debug';

const Sessions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [sessions, setSessions] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [backupCodes, setBackupCodes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, message: '' });
  const { apiRequest } = useAuth();

  useEffect(() => {
    loadSessions();
    loadSecurityEvents();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await apiRequest('/api/sessions/my-sessions');
      const data = await response.json();
      setSessions(data.sessions);
      setLoading(false);
    } catch (err) {
      enqueueSnackbar('Failed to load sessions', { variant: 'error' });
      setLoading(false);
    }
  };

  const loadSecurityEvents = async () => {
    try {
      const response = await apiRequest('/api/sessions/security-events');
      const data = await response.json();
      setSecurityEvents(data.events);
    } catch (err) {
      console.error('Failed to load security events');
    }
  };

  const handleConfirm = () => {
    if (confirmDialog.action) {
      confirmDialog.action();
    }
    setConfirmDialog({ open: false, action: null, message: '' });
  };

  const revokeSession = async (sessionId) => {
    setConfirmDialog({
      open: true,
      message: 'Are you sure you want to revoke this session?',
      action: async () => {
        try {
          const response = await apiRequest(`/api/sessions/revoke/${sessionId}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            setSessions(sessions.filter(s => s.id !== sessionId));
            enqueueSnackbar('Session revoked successfully', { variant: 'success' });
          }
        } catch (err) {
          enqueueSnackbar('Failed to revoke session', { variant: 'error' });
        }
      }
    });
  };

  const revokeAllSessions = async () => {
    setConfirmDialog({
      open: true,
      message: 'This will log you out from all other devices. Continue?',
      action: async () => {
        try {
          const response = await apiRequest('/api/sessions/revoke-all', {
            method: 'POST'
          });
          
          if (response.ok) {
            loadSessions();
            enqueueSnackbar('All other sessions revoked', { variant: 'success' });
          }
        } catch (err) {
          enqueueSnackbar('Failed to revoke sessions', { variant: 'error' });
        }
      }
    });
  };

  const generateBackupCodes = async () => {
    try {
      const response = await apiRequest('/api/sessions/backup-codes', {
        method: 'POST'
      });
      
      const data = await response.json();
      if (response.ok) {
        setBackupCodes(data.codes);
        enqueueSnackbar('Backup codes generated successfully', { variant: 'success' });
      } else {
        enqueueSnackbar(data.error || 'Failed to generate backup codes', { variant: 'error' });
      }
    } catch (err) {
      enqueueSnackbar('Failed to generate backup codes', { variant: 'error' });
    }
  };

  const getDeviceIcon = (browser) => {
    if (browser?.toLowerCase().includes('mobile')) {
      return <SmartphoneIcon />;
    }
    return <MonitorIcon />;
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'LOGIN_SUCCESS':
        return <CheckCircleIcon color="success" />;
      case 'LOGIN_FAILED':
        return <XCircleIcon color="error" />;
      case 'SECURITY_ALERT':
        return <AlertTriangleIcon color="warning" />;
      default:
        return <ActivityIcon color="action" />;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const copyAllCodes = () => {
    if (backupCodes) {
      navigator.clipboard.writeText(backupCodes.join('\n'));
      enqueueSnackbar('Codes copied to clipboard', { variant: 'info' });
    }
  };

  const downloadCodes = () => {
    if (backupCodes) {
      const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup-codes.txt';
      a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Codes downloaded', { variant: 'info' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <ShieldIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1">
              Security & Sessions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your active sessions and security settings
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          color="error"
          startIcon={<LogOutIcon />}
          onClick={revokeAllSessions}
        >
          Sign Out Everywhere Else
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" color="primary">
                    {sessions.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Sessions
                  </Typography>
                </Box>
                <MonitorIcon sx={{ fontSize: 32, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" color="success.main">
                    {sessions.filter(s => s.isCurrent).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Device
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" color="secondary">
                    {securityEvents.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recent Events
                  </Typography>
                </Box>
                <ActivityIcon sx={{ fontSize: 32, color: 'secondary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Paper elevation={3}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<MonitorIcon />} label="Active Sessions" iconPosition="start" />
          <Tab icon={<ActivityIcon />} label="Security Events" iconPosition="start" />
          <Tab icon={<KeyIcon />} label="Backup Codes" iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Sessions Tab */}
          {activeTab === 0 && (
            <List>
              {sessions.length > 0 ? (
                sessions.map((session, index) => (
                  <React.Fragment key={session.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{
                        py: 2,
                        backgroundColor: session.isCurrent ? 'primary.light' : 'transparent',
                        bgcolor: session.isCurrent ? (theme) => theme.palette.primary.main + '10' : 'transparent',
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <ListItemIcon>
                        {getDeviceIcon(session.deviceInfo?.browser)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1" fontWeight="medium">
                              {session.deviceInfo?.browser || 'Unknown Browser'}
                            </Typography>
                            {session.isCurrent && (
                              <Chip label="This Device" size="small" color="primary" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box display="flex" gap={2} mt={1}>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <GlobeIcon sx={{ fontSize: 16 }} />
                              <Typography variant="caption">
                                {session.deviceInfo?.ip || 'Unknown IP'}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <ClockIcon sx={{ fontSize: 16 }} />
                              <Typography variant="caption">
                                {formatTimeAgo(session.lastUsed)}
                              </Typography>
                            </Box>
                            {session.location && (
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <MapPinIcon sx={{ fontSize: 16 }} />
                                <Typography variant="caption">
                                  {session.location}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        }
                      />
                      {!session.isCurrent && (
                        <ListItemSecondaryAction>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => revokeSession(session.id)}
                          >
                            Revoke
                          </Button>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  </React.Fragment>
                ))
              ) : (
                <Box textAlign="center" py={8}>
                  <Typography color="text.secondary">
                    No active sessions found
                  </Typography>
                </Box>
              )}
            </List>
          )}

          {/* Security Events Tab */}
          {activeTab === 1 && (
            <List>
              {securityEvents.length > 0 ? (
                securityEvents.map((event, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ py: 2 }}>
                      <ListItemIcon>
                        {getEventIcon(event.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" fontWeight="medium">
                            {event.type?.replace(/_/g, ' ') || 'Unknown Event'}
                          </Typography>
                        }
                        secondary={
                          <Box display="flex" gap={2} mt={0.5}>
                            <Typography variant="caption">
                              {event.ip || 'Unknown IP'}
                            </Typography>
                            <Typography variant="caption">
                              {event.device || 'Unknown Device'}
                            </Typography>
                            <Typography variant="caption">
                              {formatTimeAgo(event.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))
              ) : (
                <Box textAlign="center" py={8}>
                  <Typography color="text.secondary">
                    No security events to display
                  </Typography>
                </Box>
              )}
            </List>
          )}

          {/* Backup Codes Tab */}
          {activeTab === 2 && (
            <Box>
              {!backupCodes ? (
                <Box textAlign="center" py={8}>
                  <KeyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Backup Codes
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph sx={{ maxWidth: 400, mx: 'auto' }}>
                    Generate one-time use backup codes for emergency access when you can't use your authenticator app.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<KeyIcon />}
                    onClick={generateBackupCodes}
                    sx={{ mt: 2 }}
                  >
                    Generate Backup Codes
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    <AlertTitle>Important: Save these codes securely!</AlertTitle>
                    Each code can only be used once. Store them in a safe place like a password manager.
                  </Alert>
                  
                  <Grid container spacing={2} mb={3}>
                    {backupCodes.map((code, index) => (
                      <Grid item xs={6} sm={4} md={2.4} key={index}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            textAlign: 'center',
                            bgcolor: 'grey.100',
                            fontFamily: 'monospace'
                          }}
                        >
                          {code}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  
                  <Box display="flex" justifyContent="center" gap={2}>
                    <Button
                      variant="outlined"
                      startIcon={<CopyIcon />}
                      onClick={copyAllCodes}
                    >
                      Copy All
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={downloadCodes}
                    >
                      Download
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<RefreshCwIcon />}
                      onClick={generateBackupCodes}
                    >
                      Regenerate
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, action: null, message: '' })}
      >
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, action: null, message: '' })}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} variant="contained" color="error">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Sessions;