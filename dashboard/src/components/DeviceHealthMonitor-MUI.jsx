import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  LinearProgress,
  Avatar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Badge,
  useTheme
} from '@mui/material';
import {
  Computer,
  Wifi,
  WifiOff,
  CheckCircle,
  Cancel,
  Warning,
  Error as ErrorIcon,
  Search,
  Refresh,
  Storage,
  Print,
  Scanner,
  Videocam,
  Apps,
  Circle
} from '@mui/icons-material';

const DeviceHealthMonitor = ({ devices, onDeviceSelect, autoRefresh }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState(null);

  if (!devices) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">Device Health Monitor</Typography>
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading devices...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Filter devices
  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          device.ip?.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || device.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: devices.length,
    healthy: devices.filter(d => d.status === 'healthy' || d.status === 'online').length,
    warning: devices.filter(d => d.status === 'warning').length,
    critical: devices.filter(d => d.status === 'critical' || d.status === 'error').length,
    offline: devices.filter(d => d.status === 'offline').length
  };

  const getDeviceIcon = (type) => {
    const icons = {
      printer: <Print />,
      scanner: <Scanner />,
      camera: <Videocam />,
      nas: <Storage />,
      application: <Apps />,
      default: <Computer />
    };
    return icons[type?.toLowerCase()] || icons.default;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'healthy':
      case 'online':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
      case 'error':
        return 'error';
      case 'offline':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'healthy':
      case 'online':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'critical':
      case 'error':
        return <ErrorIcon color="error" />;
      case 'offline':
        return <WifiOff color="disabled" />;
      default:
        return <Circle />;
    }
  };

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Device Health Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and manage your SMTP-enabled devices
          </Typography>
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: `${theme.palette.success.light}20` }}>
              <Typography variant="h4" color="success.main">{stats.healthy}</Typography>
              <Typography variant="caption">Online</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: `${theme.palette.warning.light}20` }}>
              <Typography variant="h4" color="warning.main">{stats.warning}</Typography>
              <Typography variant="caption">Warning</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: `${theme.palette.error.light}20` }}>
              <Typography variant="h4" color="error.main">{stats.critical}</Typography>
              <Typography variant="caption">Critical</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: theme.palette.grey[200] }}>
              <Typography variant="h4" color="text.secondary">{stats.offline}</Typography>
              <Typography variant="caption">Offline</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1, maxWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
          
          <ToggleButtonGroup
            value={filterStatus}
            exclusive
            onChange={(e, value) => value && setFilterStatus(value)}
            size="small"
          >
            <ToggleButton value="all">
              All ({devices.length})
            </ToggleButton>
            <ToggleButton value="online">
              Online ({stats.healthy})
            </ToggleButton>
            <ToggleButton value="warning">
              Warning ({stats.warning})
            </ToggleButton>
            <ToggleButton value="error">
              Error ({stats.critical})
            </ToggleButton>
            <ToggleButton value="offline">
              Offline ({stats.offline})
            </ToggleButton>
          </ToggleButtonGroup>

          {autoRefresh && (
            <Chip
              icon={<Refresh />}
              label="Auto Refresh"
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {/* Devices Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Device</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell align="right">Emails Sent</TableCell>
                <TableCell align="right">Health</TableCell>
                <TableCell>Last Seen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDevices.map((device) => {
                const healthScore = device.health || 
                  (device.status === 'healthy' || device.status === 'online' ? 100 : 
                   device.status === 'warning' ? 75 : 
                   device.status === 'error' || device.status === 'critical' ? 25 : 0);
                
                return (
                  <TableRow
                    key={device.id}
                    hover
                    onClick={() => {
                      setSelectedDevice(device);
                      onDeviceSelect?.(device);
                    }}
                    sx={{ 
                      cursor: 'pointer',
                      opacity: device.status === 'offline' ? 0.6 : 1
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ 
                          width: 32, 
                          height: 32,
                          backgroundColor: 
                            getStatusColor(device.status) === 'default' 
                              ? theme.palette.grey[300]
                              : theme.palette[getStatusColor(device.status)].light 
                        }}>
                          {getDeviceIcon(device.type)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {device.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {device.type}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(device.status)}
                        label={device.status}
                        size="small"
                        color={getStatusColor(device.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {device.ip || 'N/A'}
                      </Typography>
                      {device.port && (
                        <Typography variant="caption" color="text.secondary">
                          Port {device.port}
                        </Typography>
                      )}
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2">
                        {device.emailsSent?.toLocaleString() || 0}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={healthScore}
                          sx={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: theme.palette.grey[200],
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: 
                                healthScore > 80 ? theme.palette.success.main :
                                healthScore > 50 ? theme.palette.warning.main :
                                theme.palette.error.main
                            }
                          }}
                        />
                        <Typography variant="caption">
                          {healthScore}%
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="caption">
                        {device.lastSeen ? 
                          new Date(device.lastSeen).toLocaleString() : 
                          'Never'}
                      </Typography>
                      {device.lastError && (
                        <Tooltip title={device.lastError}>
                          <ErrorIcon 
                            sx={{ 
                              fontSize: 16, 
                              color: 'error.main',
                              ml: 0.5,
                              verticalAlign: 'middle'
                            }} 
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredDevices.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No devices found matching your criteria
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceHealthMonitor;