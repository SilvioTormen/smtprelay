import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  AlertTitle,
  Avatar,
  Stack,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  CircularProgress,
  useTheme,
  alpha,
  Skeleton,
  Collapse,
  Badge
} from '@mui/material';
import {
  Computer as SystemIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  Schedule as UptimeIcon,
  Apps as ProcessIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  CloudQueue as CloudIcon,
  Email as EmailIcon,
  CheckCircle as CheckIcon,
  Speed as SpeedIcon,
  Dashboard as DashboardIcon,
  ExpandMore as ExpandMoreIcon,
  Dns as DnsIcon,
  DeviceHub,
  Layers,
  Hub,
  AccountTree,
  Code,
  Grain,
  Public as PublicIcon,
  Wifi as WifiIcon,
  ArrowUpward,
  Replay as RestartIcon,
  SyncAlt
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';
import { useSnackbar } from 'notistack';

// Status indicator component
const StatusIndicator = ({ status, size = 'medium' }) => {
  const theme = useTheme();
  const getColor = () => {
    switch (status) {
      case 'online':
      case 'running':
      case 'active':
        return theme.palette.success.main;
      case 'offline':
      case 'stopped':
      case 'error':
        return theme.palette.error.main;
      case 'warning':
      case 'degraded':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const sizeMap = { small: 8, medium: 12, large: 16 };
  const dotSize = sizeMap[size] || 12;

  return (
    <Box position="relative" display="inline-flex" alignItems="center">
      <Box
        sx={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          bgcolor: getColor(),
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            bgcolor: getColor(),
            animation: status === 'online' || status === 'running' ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%': {
                transform: 'scale(0.95)',
                boxShadow: `0 0 0 0 ${alpha(getColor(), 0.7)}`
              },
              '70%': {
                transform: 'scale(1)',
                boxShadow: `0 0 0 10px ${alpha(getColor(), 0)}`
              },
              '100%': {
                transform: 'scale(0.95)',
                boxShadow: `0 0 0 0 ${alpha(getColor(), 0)}`
              }
            }
          }
        }}
      />
    </Box>
  );
};

const SystemConfig = () => {
  const { apiRequest } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    system: true,
    resources: true,
    network: true
  });
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchSystemInfo, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchSystemInfo = async () => {
    if (!loading) setRefreshing(true);
    try {
      const response = await apiRequest('/api/system/info');
      
      if (!response.ok) {
        throw new Error('Failed to fetch system information');
      }
      
      const data = await response.json();
      setSystemInfo(data);
    } catch (err) {
      console.error('Error fetching system info:', err);
      enqueueSnackbar('Failed to load system information', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'success' });
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!systemInfo) {
    return (
      <Alert 
        severity="error" 
        sx={{ borderRadius: 2 }}
        action={
          <Button color="inherit" size="small" onClick={fetchSystemInfo}>
            Retry
          </Button>
        }
      >
        <AlertTitle>Error</AlertTitle>
        Failed to load system information
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.1)} 0%, ${alpha(theme.palette.secondary.dark, 0.1)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.1)} 100%)`
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box display="flex" alignItems="center" gap={2}>
              <Badge
                badgeContent={<StatusIndicator status="online" size="small" />}
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                  }}
                >
                  <SystemIcon fontSize="large" />
                </Avatar>
              </Badge>
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  System Information
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {systemInfo?.hostname || 'Loading...'} • Last updated: {new Date().toLocaleTimeString()}
                </Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box display="flex" justifyContent="flex-end" alignItems="center" gap={2}>
              <Tooltip title={autoRefresh ? "Auto-refresh ON (30s)" : "Auto-refresh OFF"}>
                <IconButton
                  onClick={() => {
                    setAutoRefresh(!autoRefresh);
                    enqueueSnackbar(
                      !autoRefresh ? 'Auto-refresh enabled (30s interval)' : 'Auto-refresh disabled', 
                      { variant: 'info' }
                    );
                  }}
                  color={autoRefresh ? "primary" : "default"}
                >
                  <SyncAlt />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Refresh Now">
                <IconButton 
                  onClick={() => {
                    fetchSystemInfo();
                    enqueueSnackbar('Refreshing system information...', { variant: 'info' });
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { 
            label: 'Uptime', 
            value: systemInfo?.uptime ? formatUptime(systemInfo.uptime) : 'N/A',
            icon: <UptimeIcon />,
            color: 'primary'
          },
          { 
            label: 'CPU Cores', 
            value: systemInfo?.cpu?.cores || 'N/A',
            icon: <Grain />,
            color: 'secondary'
          },
          { 
            label: 'Memory', 
            value: systemInfo?.memory ? `${Math.round((systemInfo.memory.used / systemInfo.memory.total) * 100)}%` : 'N/A',
            icon: <MemoryIcon />,
            color: systemInfo?.memory && (systemInfo.memory.used / systemInfo.memory.total) > 0.8 ? 'error' : 'success'
          },
          { 
            label: 'Disk', 
            value: systemInfo?.disk ? `${Math.round((systemInfo.disk.used / systemInfo.disk.total) * 100)}%` : 'N/A',
            icon: <StorageIcon />,
            color: systemInfo?.disk && (systemInfo.disk.used / systemInfo.disk.total) > 0.8 ? 'error' : 'success'
          }
        ].map((stat, index) => (
          <Grid item xs={6} md={3} key={index}>
            <Card
              sx={{
                p: 2,
                borderRadius: 2,
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.paper, 0.8)
                  : 'white',
                border: `1px solid ${alpha(theme.palette[stat.color].main, 0.2)}`
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {stat.label}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {stat.value}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: alpha(theme.palette[stat.color].main, 0.1),
                    color: theme.palette[stat.color].main
                  }}
                >
                  {stat.icon}
                </Avatar>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* System Overview */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                    <SystemIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="h6" fontWeight="bold">
                    System Overview
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleSection('system')}>
                  <ExpandMoreIcon sx={{ 
                    transform: expandedSections.system ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }} />
                </IconButton>
              </Box>
              
              <Collapse in={expandedSections.system}>
                <Stack spacing={1.5}>
                  {[
                    { label: 'Hostname', value: systemInfo?.hostname, icon: <DnsIcon /> },
                    { label: 'Platform', value: systemInfo?.platform, icon: <DeviceHub /> },
                    { label: 'OS Version', value: systemInfo?.osVersion, icon: <Layers /> },
                    { label: 'Kernel', value: systemInfo?.kernel, icon: <Hub /> },
                    { label: 'Architecture', value: systemInfo?.arch, icon: <AccountTree /> },
                    { label: 'Node Version', value: systemInfo?.nodeVersion, icon: <Code /> }
                  ].map((item, index) => (
                    <Paper
                      key={index}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        background: alpha(theme.palette.background.default, 0.5),
                        border: `1px solid ${theme.palette.divider}`
                      }}
                    >
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center" gap={2}>
                          {item.icon}
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {item.label}
                            </Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {item.value || 'Unknown'}
                            </Typography>
                          </Box>
                        </Box>
                        {item.value && (
                          <IconButton size="small" onClick={() => copyToClipboard(item.value)}>
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Resource Usage */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                    <MemoryIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="h6" fontWeight="bold">
                    Resource Usage
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleSection('resources')}>
                  <ExpandMoreIcon sx={{ 
                    transform: expandedSections.resources ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }} />
                </IconButton>
              </Box>
              
              <Collapse in={expandedSections.resources}>
                {/* Memory Usage */}
                <Box mb={3}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Memory Usage</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {systemInfo?.memory ? 
                        `${formatBytes(systemInfo.memory.used)} / ${formatBytes(systemInfo.memory.total)}` 
                        : 'Unknown'}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemInfo?.memory ? (systemInfo.memory.used / systemInfo.memory.total) * 100 : 0}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 5,
                        background: systemInfo?.memory && (systemInfo.memory.used / systemInfo.memory.total) > 0.8 
                          ? `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`
                          : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
                      }
                    }}
                  />
                  {systemInfo?.memory?.free && (
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(systemInfo.memory.free)} available
                    </Typography>
                  )}
                </Box>

                {/* Disk Usage */}
                <Box mb={3}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Disk Usage</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {systemInfo?.disk ? 
                        `${formatBytes(systemInfo.disk.used)} / ${formatBytes(systemInfo.disk.total)}` 
                        : 'Unknown'}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemInfo?.disk ? (systemInfo.disk.used / systemInfo.disk.total) * 100 : 0}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 5,
                        background: systemInfo?.disk && (systemInfo.disk.used / systemInfo.disk.total) > 0.8 
                          ? `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`
                          : `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`
                      }
                    }}
                  />
                  {systemInfo?.disk?.free && (
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(systemInfo.disk.free)} available
                    </Typography>
                  )}
                </Box>

                {/* CPU Info */}
                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Grain fontSize="small" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            CPU Cores
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {systemInfo?.cpu?.cores || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <SpeedIcon fontSize="small" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Load Average
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {systemInfo?.loadAvg?.map(v => v.toFixed(2)).join(' ') || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Services & Network */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                    <NetworkIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="h6" fontWeight="bold">
                    Services & Network
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleSection('network')}>
                  <ExpandMoreIcon sx={{ 
                    transform: expandedSections.network ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }} />
                </IconButton>
              </Box>
              
              <Collapse in={expandedSections.network}>
                <Grid container spacing={3}>
                  {/* Services Status */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Active Services
                    </Typography>
                    <Stack spacing={1}>
                      {[
                        { 
                          name: 'SMTP Server', 
                          port: systemInfo?.ports?.smtp || '25',
                          status: systemInfo?.services?.smtp || 'active',
                          icon: <EmailIcon />
                        },
                        { 
                          name: 'API Server', 
                          port: systemInfo?.ports?.api || '3001',
                          status: systemInfo?.services?.api || 'active',
                          icon: <CloudIcon />
                        },
                        { 
                          name: 'Dashboard', 
                          port: systemInfo?.ports?.dashboard || '3001',
                          status: systemInfo?.services?.dashboard || 'active',
                          icon: <DashboardIcon />
                        },
                        {
                          name: 'PM2 Process',
                          port: 'N/A',
                          status: systemInfo?.pm2?.status || 'unknown',
                          icon: <ProcessIcon />
                        }
                      ].map((service, index) => (
                        <Paper
                          key={index}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: `1px solid ${theme.palette.divider}`
                          }}
                        >
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box display="flex" alignItems="center" gap={2}>
                              {service.icon}
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {service.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Port: {service.port}
                                </Typography>
                              </Box>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <StatusIndicator status={service.status} />
                              <Chip
                                label={service.status}
                                size="small"
                                color={
                                  service.status === 'active' || service.status === 'running' ? 'success' :
                                  service.status === 'stopped' || service.status === 'error' ? 'error' :
                                  'warning'
                                }
                                variant="outlined"
                              />
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </Stack>
                  </Grid>

                  {/* Network Info */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Network Information
                    </Typography>
                    <Stack spacing={2}>
                      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                        <Typography variant="caption" color="text.secondary">
                          IP Addresses
                        </Typography>
                        <Box mt={1}>
                          {systemInfo?.network?.ips?.map((ip, index) => (
                            <Chip
                              key={index}
                              label={ip}
                              size="small"
                              sx={{ mr: 1, mb: 1, fontFamily: 'monospace' }}
                              icon={<WifiIcon />}
                              onClick={() => copyToClipboard(ip)}
                            />
                          )) || <Typography variant="body2">No IP addresses found</Typography>}
                        </Box>
                      </Paper>
                      
                      <Paper sx={{ p: 2, borderRadius: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <ArrowUpward fontSize="small" color="primary" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Uptime
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {systemInfo?.pm2?.uptime || 'Unknown'}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <RestartIcon fontSize="small" color="secondary" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Restarts
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {systemInfo?.pm2?.restarts || '0'}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Stack>
                  </Grid>
                </Grid>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SystemConfig;