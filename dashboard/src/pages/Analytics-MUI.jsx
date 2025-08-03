import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Grid,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Switch,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Tooltip,
  Stack,
  Menu
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  Public as GlobeIcon,
  ShowChart as ActivityIcon,
  Computer as MonitorIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Notifications as BellIcon,
  TrendingUp as TrendingUpIcon,
  Warning as AlertTriangleIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';
import EmailFlowSankey from '../components/EmailFlowSankey-Simple';
import GeoHeatMap from '../components/GeoHeatMap-Simple';
import TimeSeriesAnalytics from '../components/TimeSeriesAnalytics';
import DeviceHealthMonitor from '../components/DeviceHealthMonitor';

const Analytics = () => {
  const { apiRequest } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    emailFlow: null,
    geoDistribution: null,
    timeSeries: null,
    deviceHealth: null,
    alerts: []
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  // Load all analytics data
  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      const [flowRes, geoRes, timeRes, deviceRes, alertsRes] = await Promise.all([
        apiRequest('/api/analytics/email-flow'),
        apiRequest('/api/analytics/geo-distribution'),
        apiRequest('/api/analytics/time-series'),
        apiRequest('/api/analytics/device-health'),
        apiRequest('/api/analytics/alerts')
      ]);

      const [flowData, geoData, timeData, deviceData, alertsData] = await Promise.all([
        flowRes.json(),
        geoRes.json(),
        timeRes.json(),
        deviceRes.json(),
        alertsRes.json()
      ]);

      setData({
        emailFlow: flowData.data,
        geoDistribution: geoData.data,
        timeSeries: timeData.data,
        deviceHealth: deviceData.devices,
        alerts: alertsData.alerts
      });

      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      setLoading(false);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    loadAnalyticsData();

    if (autoRefresh) {
      const interval = setInterval(loadAnalyticsData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Export analytics data
  const handleExport = async (format = 'json') => {
    try {
      const response = await apiRequest('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          dataTypes: ['all'],
          range: '24h'
        })
      });

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
    setExportAnchorEl(null);
  };

  const tabs = [
    { label: 'Overview', icon: <BarChartIcon /> },
    { label: 'Email Flow', icon: <ActivityIcon /> },
    { label: 'Geographic', icon: <GlobeIcon /> },
    { label: 'Time Series', icon: <TrendingUpIcon /> },
    { label: 'Device Health', icon: <MonitorIcon /> }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }} color="text.secondary">
            Loading analytics data...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container alignItems="center" spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="h4" gutterBottom>
                Analytics Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time insights and monitoring for your SMTP relay infrastructure
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Last updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center">
                {/* Auto Refresh */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Auto Refresh"
                />
                
                {autoRefresh && (
                  <FormControl size="small" sx={{ minWidth: 80 }}>
                    <Select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(e.target.value)}
                    >
                      <MenuItem value={10000}>10s</MenuItem>
                      <MenuItem value={30000}>30s</MenuItem>
                      <MenuItem value={60000}>1m</MenuItem>
                      <MenuItem value={300000}>5m</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {/* Manual Refresh */}
                <Tooltip title="Refresh Data">
                  <IconButton onClick={loadAnalyticsData} color="primary">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>

                {/* Export Button */}
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={(e) => setExportAnchorEl(e.currentTarget)}
                >
                  Export
                </Button>
                <Menu
                  anchorEl={exportAnchorEl}
                  open={Boolean(exportAnchorEl)}
                  onClose={() => setExportAnchorEl(null)}
                >
                  <MenuItem onClick={() => handleExport('json')}>Export as JSON</MenuItem>
                  <MenuItem onClick={() => handleExport('csv')}>Export as CSV</MenuItem>
                </Menu>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Alerts Banner */}
      {data.alerts && data.alerts.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <IconButton size="small" color="inherit">
              <BellIcon />
            </IconButton>
          }
        >
          <AlertTitle>Active Alerts ({data.alerts.length})</AlertTitle>
          <Stack spacing={1}>
            {data.alerts.slice(0, 3).map(alert => (
              <Box key={alert.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  size="small"
                  label={alert.severity}
                  color={
                    alert.severity === 'critical' ? 'error' :
                    alert.severity === 'warning' ? 'warning' : 'info'
                  }
                />
                <Typography variant="body2">{alert.message}</Typography>
              </Box>
            ))}
          </Stack>
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {/* Overview Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <EmailFlowSankey data={data.emailFlow} />
              </Grid>
              <Grid item xs={12} lg={6}>
                <TimeSeriesAnalytics data={data.timeSeries} />
              </Grid>
              <Grid item xs={12} lg={6}>
                <DeviceHealthMonitor 
                  devices={data.deviceHealth}
                  onDeviceSelect={(device) => console.log('Selected device:', device)}
                />
              </Grid>
            </Grid>
          )}

          {/* Email Flow Tab */}
          {activeTab === 1 && (
            <EmailFlowSankey data={data.emailFlow} height={600} />
          )}

          {/* Geographic Tab */}
          {activeTab === 2 && (
            <GeoHeatMap data={data.geoDistribution} height="600px" />
          )}

          {/* Time Series Tab */}
          {activeTab === 3 && (
            <TimeSeriesAnalytics data={data.timeSeries} timeRange="24h" />
          )}

          {/* Device Health Tab */}
          {activeTab === 4 && (
            <DeviceHealthMonitor 
              devices={data.deviceHealth}
              onDeviceSelect={(device) => console.log('Selected device:', device)}
              autoRefresh={autoRefresh}
            />
          )}
        </Box>
      </Card>
    </Box>
  );
};

export default Analytics;