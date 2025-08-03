import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Email as EmailIcon,
  DevicesOther as DevicesIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useWebSocket } from '../contexts/WebSocketContext';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon, color, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <Card elevation={3}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
            {trend && (
              <Typography variant="body2" color={trend > 0 ? 'success.main' : 'error.main'}>
                {trend > 0 ? '+' : ''}{trend}%
              </Typography>
            )}
          </Box>
          <Box sx={{ color }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

const Dashboard = () => {
  const { socket, connected } = useWebSocket();
  const [stats, setStats] = useState({
    totalEmails: 0,
    emailsToday: 0,
    activeDevices: 0,
    queueSize: 0,
    successRate: 0,
    avgProcessingTime: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemHealth, setSystemHealth] = useState({
    smtp: 'healthy',
    exchange: 'healthy',
    redis: 'healthy',
    disk: 85,
    memory: 65,
    cpu: 45,
  });

  useEffect(() => {
    if (socket && connected) {
      socket.emit('request:stats');
      
      socket.on('stats:update', (data) => {
        // Merge with existing state to prevent undefined values
        setStats(prevStats => ({
          ...prevStats,
          totalEmails: data.totalEmails ?? prevStats.totalEmails,
          emailsToday: data.emailsToday ?? prevStats.emailsToday,
          activeDevices: data.activeDevices ?? prevStats.activeDevices,
          queueSize: data.queueSize ?? prevStats.queueSize,
          successRate: data.successRate ?? prevStats.successRate,
          avgProcessingTime: data.avgProcessingTime ?? prevStats.avgProcessingTime,
        }));
      });

      socket.on('activity:update', (data) => {
        setRecentActivity(data);
      });

      socket.on('health:update', (data) => {
        setSystemHealth(data);
      });

      return () => {
        socket.off('stats:update');
        socket.off('activity:update');
        socket.off('health:update');
      };
    }
  }, [socket, connected]);

  const handleRefresh = () => {
    if (socket && connected) {
      socket.emit('request:stats');
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <CheckCircleIcon />;
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {!connected && (
        <Box mb={2}>
          <Chip 
            label="Connecting to server..." 
            color="warning" 
            icon={<WarningIcon />}
          />
        </Box>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Emails"
            value={stats.totalEmails.toLocaleString()}
            icon={<EmailIcon fontSize="large" />}
            color="primary.main"
            trend={12}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Devices"
            value={stats.activeDevices}
            icon={<DevicesIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Queue Size"
            value={stats.queueSize}
            icon={<SpeedIcon fontSize="large" />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${stats.successRate}%`}
            icon={<SecurityIcon fontSize="large" />}
            color="info.main"
          />
        </Grid>
      </Grid>

      {/* System Health */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              System Health
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center">
                  {getHealthIcon(systemHealth.smtp)}
                  <Typography sx={{ ml: 1 }}>SMTP Server</Typography>
                </Box>
                <Chip 
                  label={systemHealth.smtp} 
                  color={systemHealth.smtp === 'healthy' ? 'success' : 'error'}
                  size="small"
                />
              </Box>

              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center">
                  {getHealthIcon(systemHealth.exchange)}
                  <Typography sx={{ ml: 1 }}>Exchange Online</Typography>
                </Box>
                <Chip 
                  label={systemHealth.exchange} 
                  color={systemHealth.exchange === 'healthy' ? 'success' : 'error'}
                  size="small"
                />
              </Box>

              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center">
                  {getHealthIcon(systemHealth.redis)}
                  <Typography sx={{ ml: 1 }}>Redis Cache</Typography>
                </Box>
                <Chip 
                  label={systemHealth.redis} 
                  color={systemHealth.redis === 'healthy' ? 'success' : 'error'}
                  size="small"
                />
              </Box>

              <Box mt={3}>
                <Typography variant="body2" gutterBottom>
                  CPU Usage ({systemHealth.cpu}%)
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemHealth.cpu} 
                  color={systemHealth.cpu > 80 ? 'error' : 'primary'}
                />
              </Box>

              <Box mt={2}>
                <Typography variant="body2" gutterBottom>
                  Memory Usage ({systemHealth.memory}%)
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemHealth.memory}
                  color={systemHealth.memory > 80 ? 'error' : 'primary'}
                />
              </Box>

              <Box mt={2}>
                <Typography variant="body2" gutterBottom>
                  Disk Usage ({systemHealth.disk}%)
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemHealth.disk}
                  color={systemHealth.disk > 90 ? 'error' : systemHealth.disk > 80 ? 'warning' : 'primary'}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              {recentActivity.length === 0 ? (
                <Typography color="textSecondary" align="center">
                  No recent activity
                </Typography>
              ) : (
                recentActivity.map((activity, index) => (
                  <Box key={index} sx={{ mb: 1, pb: 1, borderBottom: '1px solid #e0e0e0' }}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">
                        {activity.device} - {activity.action}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {activity.time}
                      </Typography>
                    </Box>
                    {activity.details && (
                      <Typography variant="caption" color="textSecondary">
                        {activity.details}
                      </Typography>
                    )}
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;