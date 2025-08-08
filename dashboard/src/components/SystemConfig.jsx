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
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Button
} from '@mui/material';
import {
  Computer as SystemIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  Schedule as UptimeIcon,
  Apps as ProcessIcon,
  Folder as DirectoryIcon,
  Security as SecurityIcon,
  Code as VersionIcon,
  Settings as ServiceIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  CloudQueue as CloudIcon,
  Email as EmailIcon,
  VpnKey as CertIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';

const SystemConfig = () => {
  const { apiRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const fetchSystemInfo = async () => {
    if (!loading) setRefreshing(true);
    try {
      const response = await apiRequest('/api/system/info');
      if (!response.ok) {
        throw new Error('Failed to fetch system information');
      }
      const data = await response.json();
      setSystemInfo(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching system info:', err);
      setError('Failed to load system information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
      case 'active':
      case 'online':
      case 'healthy':
        return 'success';
      case 'stopped':
      case 'inactive':
      case 'offline':
        return 'error';
      case 'warning':
      case 'degraded':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button size="small" onClick={fetchSystemInfo} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">System Configuration</Typography>
        <IconButton onClick={fetchSystemInfo} disabled={refreshing}>
          {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* System Overview */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SystemIcon sx={{ mr: 1 }} />
                <Typography variant="h6">System Overview</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Hostname</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body2" fontFamily="monospace">
                          {systemInfo?.hostname || 'Unknown'}
                        </Typography>
                        <IconButton size="small" onClick={() => copyToClipboard(systemInfo?.hostname)}>
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Platform</TableCell>
                    <TableCell>{systemInfo?.platform || 'Unknown'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>OS Version</TableCell>
                    <TableCell>{systemInfo?.osVersion || 'Unknown'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Kernel</TableCell>
                    <TableCell>{systemInfo?.kernel || 'Unknown'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Architecture</TableCell>
                    <TableCell>{systemInfo?.arch || 'Unknown'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Uptime</TableCell>
                    <TableCell>
                      <Chip 
                        icon={<UptimeIcon />}
                        label={systemInfo?.uptime ? formatUptime(systemInfo.uptime) : 'Unknown'}
                        size="small"
                        color="primary"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Resource Usage */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <MemoryIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Resource Usage</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              {/* Memory */}
              <Box mb={3}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Memory Usage
                  </Typography>
                  <Typography variant="body2">
                    {systemInfo?.memory ? 
                      `${formatBytes(systemInfo.memory.used)} / ${formatBytes(systemInfo.memory.total)}` 
                      : 'Unknown'}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={systemInfo?.memory ? (systemInfo.memory.used / systemInfo.memory.total) * 100 : 0}
                  color={systemInfo?.memory && (systemInfo.memory.used / systemInfo.memory.total) > 0.8 ? 'error' : 'primary'}
                />
                <Typography variant="caption" color="text.secondary">
                  {systemInfo?.memory ? `${Math.round((systemInfo.memory.used / systemInfo.memory.total) * 100)}% used` : ''}
                </Typography>
              </Box>

              {/* Disk */}
              <Box mb={3}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Disk Usage
                  </Typography>
                  <Typography variant="body2">
                    {systemInfo?.disk ? 
                      `${formatBytes(systemInfo.disk.used)} / ${formatBytes(systemInfo.disk.total)}` 
                      : 'Unknown'}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={systemInfo?.disk ? (systemInfo.disk.used / systemInfo.disk.total) * 100 : 0}
                  color={systemInfo?.disk && (systemInfo.disk.used / systemInfo.disk.total) > 0.8 ? 'error' : 'primary'}
                />
                <Typography variant="caption" color="text.secondary">
                  {systemInfo?.disk ? `${Math.round((systemInfo.disk.used / systemInfo.disk.total) * 100)}% used` : ''}
                </Typography>
              </Box>

              {/* CPU */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  CPU Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="CPU Cores" 
                      secondary={systemInfo?.cpu?.cores || 'Unknown'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Load Average" 
                      secondary={systemInfo?.loadAvg?.join(', ') || 'Unknown'}
                    />
                  </ListItem>
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Application Info */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ProcessIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Application Info</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>SMTP Relay Version</TableCell>
                    <TableCell>
                      <Chip label={systemInfo?.app?.version || 'Unknown'} size="small" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Node.js Version</TableCell>
                    <TableCell>{systemInfo?.nodeVersion || 'Unknown'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>PM2 Status</TableCell>
                    <TableCell>
                      <Chip 
                        label={systemInfo?.pm2?.status || 'Unknown'} 
                        color={getStatusColor(systemInfo?.pm2?.status)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Process Uptime</TableCell>
                    <TableCell>{systemInfo?.pm2?.uptime || 'Unknown'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Restarts</TableCell>
                    <TableCell>{systemInfo?.pm2?.restarts || '0'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Install Path</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {systemInfo?.app?.path || '/smtprelay'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Network & Services */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <NetworkIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Network & Services</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="SMTP Port" 
                    secondary={systemInfo?.ports?.smtp || '25'}
                  />
                  <Chip 
                    label={systemInfo?.services?.smtp || 'Active'} 
                    color={getStatusColor(systemInfo?.services?.smtp)}
                    size="small"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CloudIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="API Port" 
                    secondary={systemInfo?.ports?.api || '3001'}
                  />
                  <Chip 
                    label={systemInfo?.services?.api || 'Active'} 
                    color={getStatusColor(systemInfo?.services?.api)}
                    size="small"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <ServiceIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Dashboard Port" 
                    secondary={systemInfo?.ports?.dashboard || '3001'}
                  />
                  <Chip 
                    label={systemInfo?.services?.dashboard || 'Active'} 
                    color={getStatusColor(systemInfo?.services?.dashboard)}
                    size="small"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <NetworkIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="IP Addresses" 
                    secondary={systemInfo?.network?.ips?.join(', ') || 'Unknown'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Security & Certificates */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SecurityIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Security & Configuration</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CertIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="TLS Certificate" 
                        secondary={systemInfo?.tls?.status || 'Not configured'}
                      />
                      {systemInfo?.tls?.valid ? 
                        <CheckIcon color="success" /> : 
                        <WarningIcon color="warning" />
                      }
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SecurityIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="IP Whitelisting" 
                        secondary={systemInfo?.security?.ipWhitelist ? 'Enabled' : 'Disabled'}
                      />
                      <Chip 
                        label={systemInfo?.security?.ipWhitelistCount || '0'} 
                        size="small"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SecurityIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="MFA Status" 
                        secondary={systemInfo?.security?.mfa ? 'Enabled' : 'Disabled'}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CloudIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Exchange Online" 
                        secondary={systemInfo?.exchange?.configured ? 'Configured' : 'Not configured'}
                      />
                      {systemInfo?.exchange?.configured && (
                        <Chip 
                          label={`${systemInfo?.exchange?.accounts || 0} accounts`} 
                          size="small"
                        />
                      )}
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <DirectoryIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Queue Directory" 
                        secondary="/smtprelay/queue"
                      />
                      <Chip 
                        label={`${systemInfo?.queue?.count || 0} items`} 
                        size="small"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <StorageIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Log Files" 
                        secondary={`${systemInfo?.logs?.size ? formatBytes(systemInfo.logs.size) : 'Unknown'}`}
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SystemConfig;