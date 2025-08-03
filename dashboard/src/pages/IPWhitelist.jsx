import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  InputAdornment,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Security as ShieldIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Error as AlertCircleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Public as GlobeIcon,
  Mail as MailIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
  Visibility as EyeIcon,
  VisibilityOff as EyeOffIcon,
  FileDownload,
  FileUpload,
  Block as BlockIcon,
  VpnKey as KeyIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext-Debug';

const IPWhitelist = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { apiRequest } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [newIP, setNewIP] = useState('');
  const [importText, setImportText] = useState('');
  const [testIP, setTestIP] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await apiRequest('/api/ip-whitelist/config');
      setConfig(data.config);
      setLoading(false);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
      setLoading(false);
    }
  };

  const handleAddIP = async () => {
    if (!newIP || !selectedCategory || !selectedSubcategory) {
      enqueueSnackbar('Please fill all fields', { variant: 'error' });
      return;
    }

    try {
      const data = await apiRequest('/api/ip-whitelist/add', {
        method: 'POST',
        body: JSON.stringify({
          category: selectedCategory,
          subcategory: selectedSubcategory,
          ip: newIP
        })
      });
      
      enqueueSnackbar(`Added ${data.ip} successfully`, { variant: 'success' });
      setShowAddModal(false);
      setNewIP('');
      loadConfig();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const handleRemoveIP = async (category, subcategory, ip) => {
    if (!confirm(`Remove ${ip} from ${category}/${subcategory}?`)) return;

    try {
      const data = await apiRequest('/api/ip-whitelist/remove', {
        method: 'POST',
        body: JSON.stringify({ category, subcategory, ip })
      });
      
      enqueueSnackbar(`Removed ${ip} successfully`, { variant: 'success' });
      loadConfig();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const handleImport = async () => {
    if (!importText || !selectedCategory || !selectedSubcategory) {
      enqueueSnackbar('Please fill all fields', { variant: 'error' });
      return;
    }

    const ips = importText.split('\n').map(ip => ip.trim()).filter(Boolean);
    
    try {
      const data = await apiRequest('/api/ip-whitelist/import', {
        method: 'POST',
        body: JSON.stringify({
          category: selectedCategory,
          subcategory: selectedSubcategory,
          ips
        })
      });
      
      const { results } = data;
      enqueueSnackbar(
        `Import complete: ${results.success.length} added, ${results.skipped.length} skipped, ${results.failed.length} failed`,
        { variant: 'success' }
      );
      setShowImportModal(false);
      setImportText('');
      loadConfig();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const handleExport = async (category, subcategory) => {
    try {
      const data = await apiRequest(`/api/ip-whitelist/export/${category}/${subcategory}`);
      
      // Create download
      const content = data.ips.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${category}_${subcategory}_ips.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      enqueueSnackbar(`Exported ${data.count} IPs`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const handleTestIP = async () => {
    if (!testIP) {
      enqueueSnackbar('Please enter an IP to test', { variant: 'error' });
      return;
    }

    try {
      const data = await apiRequest('/api/ip-whitelist/test', {
        method: 'POST',
        body: JSON.stringify({ ip: testIP })
      });
      
      setTestResults(data);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
      setTestResults(null);
    }
  };

  const handleSettingsUpdate = async (setting, value) => {
    try {
      const data = await apiRequest('/api/ip-whitelist/settings', {
        method: 'POST',
        body: JSON.stringify({ [setting]: value })
      });
      
      enqueueSnackbar('Settings updated successfully', { variant: 'success' });
      loadConfig();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const loadAuditLog = async () => {
    try {
      const data = await apiRequest('/api/ip-whitelist/audit?limit=100');
      
      setAuditLogs(data.logs);
      setShowAuditModal(true);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const filterIPs = (ips) => {
    if (!searchTerm) return ips;
    return ips.filter(ip => ip.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'info' });
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
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
              IP Whitelist Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Control access to SMTP relay and dashboard
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={() => setShowTestModal(true)}
          >
            Test IP
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={loadAuditLog}
          >
            Audit Log
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {config && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" color="primary">
                      {config.smtp_relay.no_auth_required.length + config.smtp_relay.auth_required.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      SMTP Allowed IPs
                    </Typography>
                  </Box>
                  <MailIcon sx={{ fontSize: 32, color: 'primary.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" color="success.main">
                      {config.frontend_access.allowed.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Frontend Allowed IPs
                    </Typography>
                  </Box>
                  <GlobeIcon sx={{ fontSize: 32, color: 'success.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" color="error">
                      {config.blacklist.blocked.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Blacklisted IPs
                    </Typography>
                  </Box>
                  <BlockIcon sx={{ fontSize: 32, color: 'error.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" color="secondary">
                      {config.settings.enforce_frontend_whitelist ? 'Enforced' : 'Open'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Frontend Access
                    </Typography>
                  </Box>
                  {config.settings.enforce_frontend_whitelist ? (
                    <LockIcon sx={{ fontSize: 32, color: 'secondary.main', opacity: 0.3 }} />
                  ) : (
                    <UnlockIcon sx={{ fontSize: 32, color: 'secondary.main', opacity: 0.3 }} />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content */}
      <Paper elevation={3}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<MailIcon />} label="SMTP Relay" iconPosition="start" />
          <Tab icon={<GlobeIcon />} label="Frontend Access" iconPosition="start" />
          <Tab icon={<BlockIcon />} label="Blacklist" iconPosition="start" />
          <Tab icon={<SettingsIcon />} label="Settings" iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Search and Actions Bar */}
          {activeTab !== 3 && (
            <Box display="flex" gap={2} mb={3}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search IPs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setSelectedCategory(
                    activeTab === 0 ? 'smtp_relay' :
                    activeTab === 1 ? 'frontend_access' :
                    'blacklist'
                  );
                  setSelectedSubcategory(
                    activeTab === 0 ? 'no_auth_required' :
                    activeTab === 1 ? 'allowed' :
                    'blocked'
                  );
                  setShowAddModal(true);
                }}
              >
                Add IP
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => {
                  setSelectedCategory(
                    activeTab === 0 ? 'smtp_relay' :
                    activeTab === 1 ? 'frontend_access' :
                    'blacklist'
                  );
                  setSelectedSubcategory(
                    activeTab === 0 ? 'no_auth_required' :
                    activeTab === 1 ? 'allowed' :
                    'blocked'
                  );
                  setShowImportModal(true);
                }}
              >
                Import
              </Button>
            </Box>
          )}

          {/* SMTP Relay Tab */}
          {config && activeTab === 0 && (
            <Box>
              {/* No Auth Required Section */}
              <Box mb={4}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <UnlockIcon color="success" />
                    <Typography variant="h6">
                      No Authentication Required
                    </Typography>
                    <Chip 
                      label={config.smtp_relay.no_auth_required.length} 
                      size="small" 
                      color="default"
                    />
                  </Box>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('smtp_relay', 'no_auth_required')}
                  >
                    Export
                  </Button>
                </Box>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  {filterIPs(config.smtp_relay.no_auth_required).length > 0 ? (
                    <Grid container spacing={2}>
                      {filterIPs(config.smtp_relay.no_auth_required).map(ip => (
                        <Grid item xs={12} sm={6} md={4} key={ip}>
                          <Paper elevation={1} sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" fontFamily="monospace">
                              {ip}
                            </Typography>
                            <Box display="flex" gap={0.5}>
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard(ip)}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveIP('smtp_relay', 'no_auth_required', ip)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" py={4}>
                      No IPs configured
                    </Typography>
                  )}
                </Paper>
              </Box>

              {/* Auth Required Section */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LockIcon color="warning" />
                    <Typography variant="h6">
                      Authentication Required
                    </Typography>
                    <Chip 
                      label={config.smtp_relay.auth_required.length} 
                      size="small" 
                      color="default"
                    />
                  </Box>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('smtp_relay', 'auth_required')}
                  >
                    Export
                  </Button>
                </Box>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  {filterIPs(config.smtp_relay.auth_required).length > 0 ? (
                    <Grid container spacing={2}>
                      {filterIPs(config.smtp_relay.auth_required).map(ip => (
                        <Grid item xs={12} sm={6} md={4} key={ip}>
                          <Paper elevation={1} sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" fontFamily="monospace">
                              {ip}
                            </Typography>
                            <Box display="flex" gap={0.5}>
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard(ip)}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveIP('smtp_relay', 'auth_required', ip)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" py={4}>
                      No IPs configured
                    </Typography>
                  )}
                </Paper>
              </Box>
            </Box>
          )}

          {/* Frontend Access Tab */}
          {config && activeTab === 1 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <GlobeIcon color="primary" />
                  <Typography variant="h6">
                    Allowed IPs
                  </Typography>
                  <Chip 
                    label={config.frontend_access.allowed.length} 
                    size="small" 
                    color="default"
                  />
                </Box>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('frontend_access', 'allowed')}
                >
                  Export
                </Button>
              </Box>
              
              {!config.settings.enforce_frontend_whitelist && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Frontend whitelist is not enforced. All IPs can access the dashboard.
                </Alert>
              )}

              <Paper variant="outlined" sx={{ p: 2 }}>
                {filterIPs(config.frontend_access.allowed).length > 0 ? (
                  <Grid container spacing={2}>
                    {filterIPs(config.frontend_access.allowed).map(ip => (
                      <Grid item xs={12} sm={6} md={4} key={ip}>
                        <Paper elevation={1} sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontFamily="monospace">
                            {ip}
                          </Typography>
                          <Box display="flex" gap={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(ip)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveIP('frontend_access', 'allowed', ip)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary" align="center" py={4}>
                    No IPs configured
                  </Typography>
                )}
              </Paper>
            </Box>
          )}

          {/* Blacklist Tab */}
          {config && activeTab === 2 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <BlockIcon color="error" />
                  <Typography variant="h6">
                    Blocked IPs
                  </Typography>
                  <Chip 
                    label={config.blacklist.blocked.length} 
                    size="small" 
                    color="default"
                  />
                </Box>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('blacklist', 'blocked')}
                >
                  Export
                </Button>
              </Box>

              <Paper variant="outlined" sx={{ p: 2 }}>
                {filterIPs(config.blacklist.blocked).length > 0 ? (
                  <Grid container spacing={2}>
                    {filterIPs(config.blacklist.blocked).map(ip => (
                      <Grid item xs={12} sm={6} md={4} key={ip}>
                        <Paper elevation={1} sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontFamily="monospace">
                            {ip}
                          </Typography>
                          <Box display="flex" gap={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(ip)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveIP('blacklist', 'blocked', ip)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary" align="center" py={4}>
                    No IPs blacklisted
                  </Typography>
                )}
              </Paper>
            </Box>
          )}

          {/* Settings Tab */}
          {config && activeTab === 3 && (
            <Box>
              <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Access Control Settings
                </Typography>
                
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Enforce Frontend Whitelist"
                      secondary="Only allow whitelisted IPs to access the dashboard"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        edge="end"
                        checked={config.settings.enforce_frontend_whitelist}
                        onChange={(e) => handleSettingsUpdate('enforce_frontend_whitelist', e.target.checked)}
                        color="primary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Log Denied Attempts"
                      secondary="Record all denied access attempts in audit log"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        edge="end"
                        checked={config.settings.log_denied_attempts}
                        onChange={(e) => handleSettingsUpdate('log_denied_attempts', e.target.checked)}
                        color="primary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Auto-block After Failures"
                      secondary="Number of failed attempts before auto-blacklisting"
                    />
                    <ListItemSecondaryAction>
                      <TextField
                        type="number"
                        value={config.settings.auto_block_after_failures}
                        onChange={(e) => handleSettingsUpdate('auto_block_after_failures', parseInt(e.target.value))}
                        inputProps={{ min: 0, max: 100 }}
                        size="small"
                        sx={{ width: 80 }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </Paper>

              <Alert severity="info" icon={<KeyIcon />}>
                <AlertTitle>IP Format Examples</AlertTitle>
                <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                  <li><code>192.168.1.1</code> - Single IP</li>
                  <li><code>10.0.0.0/24</code> - CIDR notation (256 IPs)</li>
                  <li><code>172.16.0.0/12</code> - Large subnet</li>
                  <li><code>2001:db8::/32</code> - IPv6 range</li>
                </Box>
              </Alert>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Add IP Dialog */}
      <Dialog open={showAddModal} onClose={() => setShowAddModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add IP Address</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory('');
                }}
                label="Category"
              >
                <MenuItem value="">Select category...</MenuItem>
                <MenuItem value="smtp_relay">SMTP Relay</MenuItem>
                <MenuItem value="frontend_access">Frontend Access</MenuItem>
                <MenuItem value="blacklist">Blacklist</MenuItem>
              </Select>
            </FormControl>

            {selectedCategory === 'smtp_relay' && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Subcategory</InputLabel>
                <Select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  label="Subcategory"
                >
                  <MenuItem value="">Select subcategory...</MenuItem>
                  <MenuItem value="no_auth_required">No Auth Required</MenuItem>
                  <MenuItem value="auth_required">Auth Required</MenuItem>
                </Select>
              </FormControl>
            )}

            {selectedCategory === 'frontend_access' && (
              <input type="hidden" value="allowed" onChange={() => setSelectedSubcategory('allowed')} />
            )}

            {selectedCategory === 'blacklist' && (
              <input type="hidden" value="blocked" onChange={() => setSelectedSubcategory('blocked')} />
            )}

            <TextField
              fullWidth
              margin="normal"
              label="IP Address"
              value={newIP}
              onChange={(e) => setNewIP(e.target.value)}
              placeholder="e.g., 192.168.1.1 or 10.0.0.0/24"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddModal(false);
            setNewIP('');
            setSelectedCategory('');
            setSelectedSubcategory('');
          }}>
            Cancel
          </Button>
          <Button onClick={handleAddIP} variant="contained">
            Add IP
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportModal} onClose={() => setShowImportModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import IP Addresses</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory('');
                }}
                label="Category"
              >
                <MenuItem value="">Select category...</MenuItem>
                <MenuItem value="smtp_relay">SMTP Relay</MenuItem>
                <MenuItem value="frontend_access">Frontend Access</MenuItem>
                <MenuItem value="blacklist">Blacklist</MenuItem>
              </Select>
            </FormControl>

            {selectedCategory === 'smtp_relay' && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Subcategory</InputLabel>
                <Select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  label="Subcategory"
                >
                  <MenuItem value="">Select subcategory...</MenuItem>
                  <MenuItem value="no_auth_required">No Auth Required</MenuItem>
                  <MenuItem value="auth_required">Auth Required</MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              fullWidth
              margin="normal"
              label="IP Addresses (one per line)"
              multiline
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"192.168.1.1\n10.0.0.0/24\n172.16.0.0/16"}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowImportModal(false);
            setImportText('');
            setSelectedCategory('');
            setSelectedSubcategory('');
          }}>
            Cancel
          </Button>
          <Button onClick={handleImport} variant="contained">
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test IP Dialog */}
      <Dialog open={showTestModal} onClose={() => setShowTestModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Test IP Address</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              margin="normal"
              label="IP Address"
              value={testIP}
              onChange={(e) => setTestIP(e.target.value)}
              placeholder="e.g., 192.168.1.1"
            />

            {testResults && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                <List dense>
                  <ListItem>
                    <ListItemText primary="IP Type" secondary={testResults.type} />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText primary="Blacklisted" />
                    <ListItemSecondaryAction>
                      {testResults.blacklisted ? (
                        <Chip
                          icon={<CancelIcon />}
                          label="Yes"
                          color="error"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="No"
                          color="success"
                          size="small"
                        />
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText primary="SMTP Access" />
                    <ListItemSecondaryAction>
                      {testResults.smtp_access.allowed ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label={testResults.smtp_access.requiresAuth ? 'Auth Required' : 'No Auth'}
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<CancelIcon />}
                          label="Denied"
                          color="error"
                          size="small"
                        />
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText primary="Frontend Access" />
                    <ListItemSecondaryAction>
                      {testResults.frontend_access ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Allowed"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<CancelIcon />}
                          label="Denied"
                          color="error"
                          size="small"
                        />
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowTestModal(false);
            setTestIP('');
            setTestResults(null);
          }}>
            Close
          </Button>
          <Button onClick={handleTestIP} variant="contained">
            Test IP
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog 
        open={showAuditModal} 
        onClose={() => setShowAuditModal(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Audit Log</Typography>
            <IconButton onClick={() => setShowAuditModal(false)}>
              <CancelIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>User</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map(log => (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.action}
                        size="small"
                        color={
                          log.action === 'ADD' ? 'success' :
                          log.action === 'REMOVE' ? 'error' :
                          log.action === 'DENIED_ACCESS' ? 'warning' :
                          'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {log.category}/{log.subcategory}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {log.value}
                      </Typography>
                    </TableCell>
                    <TableCell>{log.user}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default IPWhitelist;