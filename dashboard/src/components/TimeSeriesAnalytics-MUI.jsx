import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Paper,
  Chip,
  Stack,
  LinearProgress,
  useTheme
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  Email,
  Speed,
  Error as ErrorIcon,
  Schedule,
  Storage
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const TimeSeriesAnalytics = ({ data, timeRange = '24h' }) => {
  const theme = useTheme();
  const [selectedMetric, setSelectedMetric] = useState('all');
  
  if (!data) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">Time Series Analytics</Typography>
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading metrics...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const chartData = data.sent?.map((item, index) => ({
    time: new Date(item.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    sent: item.value,
    received: data.received?.[index]?.value || 0,
    failed: data.failed?.[index]?.value || 0,
    queued: data.queued?.[index]?.value || 0
  })) || [];

  // Calculate statistics
  const calculateStats = (metricData) => {
    if (!metricData || metricData.length === 0) return { current: 0, avg: 0, trend: 'stable' };
    const values = metricData.map(d => d.value);
    const current = values[values.length - 1];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trend = secondAvg > firstAvg * 1.1 ? 'up' : secondAvg < firstAvg * 0.9 ? 'down' : 'stable';
    return { current, avg: Math.round(avg), trend };
  };

  const metrics = [
    {
      key: 'sent',
      label: 'Emails Sent',
      color: theme.palette.primary.main,
      icon: <Email />,
      stats: calculateStats(data.sent)
    },
    {
      key: 'received',
      label: 'Received',
      color: theme.palette.success.main,
      icon: <ShowChart />,
      stats: calculateStats(data.received)
    },
    {
      key: 'failed',
      label: 'Failed',
      color: theme.palette.error.main,
      icon: <ErrorIcon />,
      stats: calculateStats(data.failed)
    },
    {
      key: 'queued',
      label: 'Queue Size',
      color: theme.palette.warning.main,
      icon: <Storage />,
      stats: calculateStats(data.queued)
    }
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Time Series Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Email metrics over the last {timeRange}
          </Typography>
        </Box>

        {/* Metric Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {metrics.map((metric) => (
            <Grid item xs={12} sm={6} md={3} key={metric.key}>
              <Paper
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: selectedMetric === metric.key ? 2 : 0,
                  borderColor: metric.color,
                  transition: 'all 0.3s',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
                onClick={() => setSelectedMetric(metric.key)}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ color: metric.color }}>
                    {metric.icon}
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <Typography variant="h5">
                      {metric.stats.current.toLocaleString()}
                    </Typography>
                  </Box>
                  {metric.stats.trend === 'up' && <TrendingUp color="success" />}
                  {metric.stats.trend === 'down' && <TrendingDown color="error" />}
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(metric.stats.current / metric.stats.avg) * 100}
                  sx={{
                    mt: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: theme.palette.grey[200],
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: metric.color
                    }
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  Avg: {metric.stats.avg.toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Chart */}
        <Paper sx={{ p: 2, backgroundColor: theme.palette.background.default }}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis 
                dataKey="time" 
                stroke={theme.palette.text.secondary}
                fontSize={12}
              />
              <YAxis 
                stroke={theme.palette.text.secondary}
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 4
                }}
              />
              <Legend />
              
              {(selectedMetric === 'all' || selectedMetric === 'sent') && (
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke={theme.palette.primary.main}
                  fill={theme.palette.primary.light}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              
              {(selectedMetric === 'all' || selectedMetric === 'received') && (
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke={theme.palette.success.main}
                  fill={theme.palette.success.light}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              
              {(selectedMetric === 'all' || selectedMetric === 'failed') && (
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke={theme.palette.error.main}
                  fill={theme.palette.error.light}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              
              {(selectedMetric === 'all' || selectedMetric === 'queued') && (
                <Area
                  type="monotone"
                  dataKey="queued"
                  stroke={theme.palette.warning.main}
                  fill={theme.palette.warning.light}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </Paper>

        {/* View Options */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <ToggleButtonGroup
            value={selectedMetric}
            exclusive
            onChange={(e, value) => value && setSelectedMetric(value)}
            size="small"
          >
            <ToggleButton value="all">All Metrics</ToggleButton>
            <ToggleButton value="sent">Sent</ToggleButton>
            <ToggleButton value="received">Received</ToggleButton>
            <ToggleButton value="failed">Failed</ToggleButton>
            <ToggleButton value="queued">Queue</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TimeSeriesAnalytics;