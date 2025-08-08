import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  Button,
  Divider,
  Alert,
  AlertTitle,
  CircularProgress,
  Tooltip,
  LinearProgress,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  TextField,
  Snackbar
} from '@mui/material';
import {
  CloudDone as ConnectedIcon,
  CloudOff as DisconnectedIcon,
  Security as TokenIcon,
  Mail as MailboxIcon,
  Apps as AppsIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Timer as TimerIcon,
  VpnKey as KeyIcon,
  AccountBox as AccountIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';
import AdminAuthDialog from './AdminAuthDialog';

const ExchangeStatusDashboard = ({ onSetupStart, onEdit }) => {
  const { apiRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ 
    open: false, 
    app: null,
    deleteOption: 'config', // 'config' or 'everything'
    confirmName: '',
    adminAuth: false,
    processing: false
  });
  const [adminAuthDialog, setAdminAuthDialog] = useState({
    open: false,
    tenantId: null
  });
  const [expandedSections, setExpandedSections] = useState({
    applications: true,
    tokens: true,
    mailboxes: true
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [mailboxDeleteDialog, setMailboxDeleteDialog] = useState({
    open: false,
    mailbox: null,
    processing: false
  });

  useEffect(() => {
    fetchCompleteStatus();
    // Refresh status every 60 seconds (increased from 30 to avoid rate limiting)
    const interval = setInterval(fetchCompleteStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchCompleteStatus = async () => {
    try {
      setLoading(true);
      
      // Fetch comprehensive status
      const [configResponse, tokenResponse, mailboxResponse] = await Promise.all([
        apiRequest('/api/exchange-config/status'),
        apiRequest('/api/exchange-config/token-status'),
        apiRequest('/api/exchange-config/mailboxes')
      ]);

      const configData = await configResponse.json();
      const tokenData = tokenResponse.ok ? await tokenResponse.json() : null;
      const mailboxData = mailboxResponse.ok ? await mailboxResponse.json() : null;

      setStatus({
        ...configData,
        tokens: tokenData,
        mailboxes: mailboxData
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setError('Failed to load Exchange status');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'valid':
      case 'active':
        return 'success';
      case 'expired':
      case 'error':
      case 'disconnected':
        return 'error';
      case 'warning':
      case 'expiring':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return 'Unknown';
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleDeleteMailbox = async () => {
    if (!mailboxDeleteDialog.mailbox) return;
    
    setMailboxDeleteDialog(prev => ({ ...prev, processing: true }));
    
    try {
      const response = await apiRequest(`/api/exchange-config/mailboxes/${encodeURIComponent(mailboxDeleteDialog.mailbox.email)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setMailboxDeleteDialog({ open: false, mailbox: null, processing: false });
        setSuccessMessage(`Mailbox ${mailboxDeleteDialog.mailbox.email} and all associated tokens have been deleted`);
        await fetchCompleteStatus();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete mailbox');
        setMailboxDeleteDialog(prev => ({ ...prev, processing: false }));
      }
    } catch (err) {
      setError('Failed to delete mailbox');
      setMailboxDeleteDialog(prev => ({ ...prev, processing: false }));
    }
  };

  const handleDeleteApp = async () => {
    if (!deleteDialog.app) return;
    
    // Check if confirmation name matches for Azure deletion
    if (deleteDialog.deleteOption === 'everything') {
      if (deleteDialog.confirmName !== deleteDialog.app.displayName) {
        setError('Application name does not match. Please type the exact name.');
        return;
      }
    }
    
    setDeleteDialog(prev => ({ ...prev, processing: true }));
    
    try {
      console.log('Sending delete request for app:', deleteDialog.app.appId);
      const response = await apiRequest('/api/exchange-config/delete-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appId: deleteDialog.app.appId,
          tenantId: deleteDialog.app.tenantId,
          displayName: deleteDialog.app.displayName,
          deleteFromAzure: deleteDialog.deleteOption === 'everything'
        })
      });
      
      console.log('Delete response status:', response.status);

      const data = await response.json();
      
      if (response.ok) {
        setDeleteDialog({ 
          open: false, 
          app: null, 
          deleteOption: 'config',
          confirmName: '',
          adminAuth: false,
          processing: false
        });
        fetchCompleteStatus(); // Refresh the status
        
        // Show success message
        if (deleteDialog.deleteOption === 'everything') {
          setError(null);
          setSuccessMessage('Application and Azure AD registration deleted successfully');
        } else {
          setSuccessMessage('Application configuration deleted successfully');
        }
      } else if (response.status === 401 && data.requiresAdminAuth) {
        // Need admin authentication for Azure deletion
        console.log('Admin auth required for Azure deletion');
        setDeleteDialog(prev => ({ ...prev, processing: false }));
        setAdminAuthDialog({
          open: true,
          tenantId: data.tenantId || deleteDialog.app.tenantId
        });
      } else {
        setError(data.error || 'Failed to delete application');
        setDeleteDialog(prev => ({ ...prev, processing: false }));
      }
    } catch (err) {
      setError('Failed to delete application');
      setDeleteDialog(prev => ({ ...prev, processing: false }));
    }
  };

  if (loading && !status) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const hasConfiguration = status?.configured || status?.applications?.length > 0;

  return (
    <Box>
      {/* Header with overall status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            {hasConfiguration ? (
              <ConnectedIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
            ) : (
              <DisconnectedIcon sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
            )}
            <Box>
              <Typography variant="h5" gutterBottom>
                Exchange Online Status
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {hasConfiguration ? 'Connected and configured' : 'Not configured - Setup required'}
              </Typography>
            </Box>
          </Box>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchCompleteStatus}
              disabled={loading}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            {!hasConfiguration && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onSetupStart}
              >
                Start Setup
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Azure AD Applications */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <AppsIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Azure AD Applications</Typography>
              {status?.applications?.length > 0 && (
                <Chip 
                  label={status.applications.length} 
                  size="small" 
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
            <IconButton onClick={() => toggleSection('applications')}>
              {expandedSections.applications ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.applications}>
            <Divider sx={{ my: 2 }} />
            {status?.applications?.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Application Name</TableCell>
                      <TableCell>Application ID</TableCell>
                      <TableCell>Tenant ID</TableCell>
                      <TableCell>Auth Method</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {status.applications.map((app, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {app.displayName || 'Unnamed Application'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {app.appId?.substring(0, 8)}...
                            </Typography>
                            <IconButton 
                              size="small" 
                              onClick={() => copyToClipboard(app.appId)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {app.tenantId?.substring(0, 8)}...
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={app.authMethod || 'Unknown'} 
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={app.status || 'Active'} 
                            color={getStatusColor(app.status || 'active')}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton 
                            size="small"
                            onClick={() => setDeleteDialog({ open: true, app })}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                No Azure AD applications configured. Click "Start Setup" to configure.
              </Alert>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Token Status */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <TokenIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Token Status</Typography>
            </Box>
            <IconButton onClick={() => toggleSection('tokens')}>
              {expandedSections.tokens ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.tokens}>
            <Divider sx={{ my: 2 }} />
            {(status?.tokens || status?.accounts?.length > 0) ? (
              <Grid container spacing={2}>
                {/* Display mailbox/account info */}
                {status?.accounts?.length > 0 && (
                  <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Accounts with Active Tokens
                      </Typography>
                      {status.accounts.map((account, idx) => (
                        <Box key={idx} display="flex" alignItems="center" sx={{ mt: idx > 0 ? 2 : 1 }}>
                          <AccountIcon sx={{ mr: 1 }} color={account.hasValidToken ? "primary" : "disabled"} />
                          <Box flex={1}>
                            <Typography variant="body2" fontWeight="medium">
                              {account.email || account.displayName || 'Unknown Account'}
                            </Typography>
                            {account.displayName && account.email && (
                              <Typography variant="caption" color="text.secondary">
                                {account.displayName}
                              </Typography>
                            )}
                          </Box>
                          <Box display="flex" gap={1}>
                            {account.isDefault && (
                              <Chip 
                                label="Default" 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                              />
                            )}
                            <Chip 
                              label={account.hasValidToken ? "Active" : "Expired"} 
                              size="small" 
                              color={account.hasValidToken ? "success" : "error"}
                            />
                          </Box>
                        </Box>
                      ))}
                    </Paper>
                  </Grid>
                )}
                
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Access Token
                        </Typography>
                        <Typography variant="h6">
                          {(status.tokens?.accessToken || status.hasTokens) ? 'Valid' : 'Not Available'}
                        </Typography>
                        {(status.tokens?.accessToken || status.hasTokens) && (
                          <Typography variant="caption" color="text.secondary">
                            Expires in: {getTimeRemaining(status.tokens?.accessTokenExpiry || status.accounts?.[0]?.tokenExpiresAt)}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        {(status.tokens?.accessToken || status.hasTokens) ? (
                          <SuccessIcon color="success" />
                        ) : (
                          <ErrorIcon color="error" />
                        )}
                      </Box>
                    </Box>
                    {(status.tokens?.accessTokenExpiry || status.accounts?.[0]?.tokenExpiresAt) && (
                      <LinearProgress 
                        variant="determinate" 
                        value={calculateTokenHealth(status.tokens?.accessTokenExpiry || status.accounts?.[0]?.tokenExpiresAt)}
                        sx={{ mt: 1 }}
                        color={getTokenHealthColor(status.tokens?.accessTokenExpiry || status.accounts?.[0]?.tokenExpiresAt)}
                      />
                    )}
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Refresh Token
                        </Typography>
                        <Typography variant="h6">
                          {(status.tokens?.refreshToken || status.accounts?.[0]?.hasRefreshToken) ? 'Valid' : 'Not Available'}
                        </Typography>
                        {(status.tokens?.refreshToken || status.accounts?.[0]?.hasRefreshToken) && (
                          <Typography variant="caption" color="text.secondary">
                            Expires in: {getTimeRemaining(status.tokens?.refreshTokenExpiry || 
                              (status.accounts?.[0]?.tokenExpiresAt ? 
                                new Date(new Date(status.accounts[0].tokenExpiresAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : 
                                null))}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        {(status.tokens?.refreshToken || status.accounts?.[0]?.hasRefreshToken) ? (
                          <SuccessIcon color="success" />
                        ) : (
                          <ErrorIcon color="error" />
                        )}
                      </Box>
                    </Box>
                    {(status.tokens?.refreshTokenExpiry || status.accounts?.[0]?.hasRefreshToken) && (
                      <LinearProgress 
                        variant="determinate" 
                        value={calculateTokenHealth(status.tokens?.refreshTokenExpiry || 
                          (status.accounts?.[0]?.tokenExpiresAt ? 
                            new Date(new Date(status.accounts[0].tokenExpiresAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : 
                            null))}
                        sx={{ mt: 1 }}
                        color={getTokenHealthColor(status.tokens?.refreshTokenExpiry || 
                          (status.accounts?.[0]?.tokenExpiresAt ? 
                            new Date(new Date(status.accounts[0].tokenExpiresAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : 
                            null))}
                      />
                    )}
                  </Paper>
                </Grid>
                
                {status.tokens.lastRefresh && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Last token refresh: {new Date(status.tokens.lastRefresh).toLocaleString()}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Alert severity="warning">
                No token information available. Please complete the setup process.
              </Alert>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Connected Mailboxes */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <MailboxIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Connected Mailboxes</Typography>
              {status?.mailboxes?.length > 0 && (
                <Chip 
                  label={status.mailboxes.length} 
                  size="small" 
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
            <Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => onEdit?.({ type: 'mailbox' })}
              >
                Add Mailbox
              </Button>
              <IconButton onClick={() => toggleSection('mailboxes')}>
                {expandedSections.mailboxes ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>
          
          <Collapse in={expandedSections.mailboxes}>
            <Divider sx={{ my: 2 }} />
            {status?.mailboxes?.length > 0 ? (
              <List>
                {status.mailboxes.map((mailbox, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <AccountIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={mailbox.email}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            Type: {mailbox.type || 'User Mailbox'}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Permissions: {mailbox.permissions?.join(', ') || 'Send As'}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip 
                        label={mailbox.status || 'Active'} 
                        color={getStatusColor(mailbox.status || 'active')}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <IconButton 
                        size="small"
                        onClick={() => setMailboxDeleteDialog({ open: true, mailbox, processing: false })}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="info">
                No mailboxes configured. The default account will be used for sending.
              </Alert>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Smart Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !deleteDialog.processing && setDeleteDialog({ 
          open: false, 
          app: null,
          deleteOption: 'config',
          confirmName: '',
          adminAuth: false,
          processing: false
        })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Application</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <Typography variant="body1" gutterBottom>
              <strong>Application:</strong> {deleteDialog.app?.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>App ID:</strong> {deleteDialog.app?.appId}
            </Typography>
          </Box>

          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              What would you like to delete?
            </Typography>
            
            <FormControl component="fieldset">
              <RadioGroup
                value={deleteDialog.deleteOption}
                onChange={(e) => setDeleteDialog(prev => ({ 
                  ...prev, 
                  deleteOption: e.target.value,
                  confirmName: ''
                }))}
              >
                <FormControlLabel
                  value="config"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">Configuration only</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Remove from SMTP Relay only (Azure AD App remains)
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="everything"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">Configuration + Azure AD App</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Completely remove everything from Azure AD
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>

          {deleteDialog.deleteOption === 'everything' && (
            <Box mt={3}>
              <Alert severity="error" sx={{ mb: 2 }}>
                <AlertTitle>⚠️ Permanent Deletion Warning</AlertTitle>
                This will permanently delete the application from Azure AD. This action cannot be undone!
              </Alert>
              
              <Typography variant="body2" gutterBottom>
                Please type <strong>{deleteDialog.app?.displayName}</strong> to confirm:
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={deleteDialog.confirmName}
                onChange={(e) => setDeleteDialog(prev => ({ 
                  ...prev, 
                  confirmName: e.target.value 
                }))}
                placeholder="Type application name here"
                disabled={deleteDialog.processing}
                error={deleteDialog.confirmName && deleteDialog.confirmName !== deleteDialog.app?.displayName}
                helperText={
                  deleteDialog.confirmName && deleteDialog.confirmName !== deleteDialog.app?.displayName
                    ? 'Name does not match'
                    : ''
                }
              />
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Note:</strong> This operation requires Azure AD administrator authentication.
              </Alert>
            </Box>
          )}

          {deleteDialog.deleteOption === 'config' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              The Azure AD application will remain in your tenant and can be reused later.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialog({ 
              open: false, 
              app: null,
              deleteOption: 'config',
              confirmName: '',
              adminAuth: false,
              processing: false
            })}
            disabled={deleteDialog.processing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteApp} 
            color="error" 
            variant="contained"
            disabled={
              deleteDialog.processing ||
              (deleteDialog.deleteOption === 'everything' && 
               deleteDialog.confirmName !== deleteDialog.app?.displayName)
            }
          >
            {deleteDialog.processing ? (
              <CircularProgress size={24} />
            ) : (
              deleteDialog.deleteOption === 'everything' 
                ? 'Delete Everything' 
                : 'Delete Configuration'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Authentication Dialog */}
      <AdminAuthDialog
        open={adminAuthDialog.open}
        tenantId={adminAuthDialog.tenantId}
        onClose={() => setAdminAuthDialog({ open: false, tenantId: null })}
        onAuthComplete={async (success) => {
          setAdminAuthDialog({ open: false, tenantId: null });
          if (success && deleteDialog.app) {
            // Retry the delete operation after successful auth
            // The admin auth is now stored in session, so the request should work
            console.log('Admin auth complete, retrying delete for:', deleteDialog.app.appId);
            
            try {
              const response = await apiRequest('/api/exchange-config/delete-app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  appId: deleteDialog.app.appId,
                  tenantId: deleteDialog.app.tenantId,
                  displayName: deleteDialog.app.displayName,
                  deleteFromAzure: deleteDialog.deleteOption === 'everything'
                })
              });
              
              const data = await response.json();
              
              if (response.ok) {
                setDeleteDialog({ 
                  open: false, 
                  app: null, 
                  deleteOption: 'config',
                  confirmName: '',
                  adminAuth: false,
                  processing: false
                });
                fetchCompleteStatus();
                setSuccessMessage('Application and Azure AD registration deleted successfully');
              } else {
                setError(data.error || 'Failed to delete application');
                setDeleteDialog(prev => ({ ...prev, processing: false }));
              }
            } catch (err) {
              setError('Failed to delete application');
              setDeleteDialog(prev => ({ ...prev, processing: false }));
            }
          }
        }}
      />
      
      {/* Mailbox Delete Confirmation Dialog */}
      <Dialog
        open={mailboxDeleteDialog.open}
        onClose={() => !mailboxDeleteDialog.processing && setMailboxDeleteDialog({ open: false, mailbox: null, processing: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Mailbox</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Warning</AlertTitle>
            This will delete the mailbox configuration and all associated tokens. The mailbox will need to be re-authenticated if you want to use it again.
          </Alert>
          
          {mailboxDeleteDialog.mailbox && (
            <Box mt={2}>
              <Typography variant="body1" gutterBottom>
                <strong>Mailbox:</strong> {mailboxDeleteDialog.mailbox.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Type:</strong> {mailboxDeleteDialog.mailbox.type || 'User Mailbox'}
              </Typography>
            </Box>
          )}
          
          <Typography variant="body2" sx={{ mt: 2 }}>
            Are you sure you want to delete this mailbox and all its tokens?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setMailboxDeleteDialog({ open: false, mailbox: null, processing: false })}
            disabled={mailboxDeleteDialog.processing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteMailbox} 
            color="error" 
            variant="contained"
            disabled={mailboxDeleteDialog.processing}
          >
            {mailboxDeleteDialog.processing ? (
              <CircularProgress size={24} />
            ) : (
              'Delete Mailbox'
            )}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSuccessMessage('')} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Helper functions
const calculateTokenHealth = (expiryDate) => {
  if (!expiryDate) return 0;
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const created = new Date(expiry.getTime() - (60 * 60 * 1000)); // Assume 1 hour token
  
  const total = expiry - created;
  const remaining = expiry - now;
  
  return Math.max(0, Math.min(100, (remaining / total) * 100));
};

const getTokenHealthColor = (expiryDate) => {
  const health = calculateTokenHealth(expiryDate);
  if (health > 50) return 'success';
  if (health > 20) return 'warning';
  return 'error';
};

export default ExchangeStatusDashboard;