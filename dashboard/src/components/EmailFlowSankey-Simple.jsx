import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Paper,
  Grid,
  Chip,
  LinearProgress,
  Stack
} from '@mui/material';
import {
  ArrowForward,
  Devices,
  Cloud,
  Email,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';

const EmailFlowSankey = ({ data, width, height }) => {
  // If no data, show placeholder
  if (!data || !data.nodes) {
    return (
      <Card sx={{ height: height || 400 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Email Flow Visualization
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <Typography color="text.secondary">Loading email flow data...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Extract values from data
  const totalEmails = data.links?.find(l => l.source === 'devices')?.value || 1500;
  const toRelay = data.links?.find(l => l.target === 'relay')?.value || 1500;
  const toExchange = data.links?.find(l => l.target === 'exchange')?.value || 1400;
  const delivered = data.links?.find(l => l.target === 'delivered')?.value || 1350;
  const failed = data.links?.find(l => l.target === 'failed')?.value || 150;

  const stages = [
    {
      name: 'Devices',
      icon: <Devices />,
      count: totalEmails,
      color: 'primary',
      percentage: 100
    },
    {
      name: 'SMTP Relay',
      icon: <Email />,
      count: toRelay,
      color: 'info',
      percentage: (toRelay / totalEmails) * 100
    },
    {
      name: 'Exchange Online',
      icon: <Cloud />,
      count: toExchange,
      color: 'secondary',
      percentage: (toExchange / totalEmails) * 100
    },
    {
      name: 'Delivered',
      icon: <CheckCircle />,
      count: delivered,
      color: 'success',
      percentage: (delivered / totalEmails) * 100
    }
  ];

  return (
    <Card sx={{ height: height || 'auto' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Email Flow Pipeline
        </Typography>
        
        <Grid container spacing={2} alignItems="center">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.name}>
              <Grid item xs={12} md={index === stages.length - 1 ? 3 : 2.5}>
                <Paper
                  elevation={2}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    backgroundColor: theme => 
                      theme.palette.mode === 'dark' 
                        ? `${theme.palette[stage.color].dark}15`
                        : `${theme.palette[stage.color].light}15`,
                    border: theme => `2px solid ${theme.palette[stage.color].main}`,
                    position: 'relative'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    <Box sx={{ color: `${stage.color}.main`, mr: 1 }}>
                      {stage.icon}
                    </Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {stage.name}
                    </Typography>
                  </Box>
                  
                  <Typography variant="h4" color={`${stage.color}.main`}>
                    {stage.count.toLocaleString()}
                  </Typography>
                  
                  <LinearProgress
                    variant="determinate"
                    value={stage.percentage}
                    sx={{
                      mt: 1,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme => theme.palette.grey[200],
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: `${stage.color}.main`
                      }
                    }}
                  />
                  
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {stage.percentage.toFixed(1)}% of total
                  </Typography>
                </Paper>
              </Grid>
              
              {index < stages.length - 1 && (
                <Grid item xs={12} md={0.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <ArrowForward color="action" sx={{ fontSize: 30 }} />
                  </Box>
                </Grid>
              )}
            </React.Fragment>
          ))}
        </Grid>

        {/* Failed emails indicator */}
        {failed > 0 && (
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'error.light', borderRadius: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <ErrorIcon color="error" />
              <Typography variant="body2">
                <strong>{failed}</strong> emails failed ({((failed / totalEmails) * 100).toFixed(1)}%)
              </Typography>
              <Chip
                label="View Details"
                size="small"
                variant="outlined"
                color="error"
                onClick={() => console.log('View failed emails')}
              />
            </Stack>
          </Box>
        )}

        {/* Summary stats */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Success Rate
              </Typography>
              <Typography variant="h6" color="success.main">
                {((delivered / totalEmails) * 100).toFixed(1)}%
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Failure Rate
              </Typography>
              <Typography variant="h6" color="error.main">
                {((failed / totalEmails) * 100).toFixed(1)}%
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Processing
              </Typography>
              <Typography variant="h6" color="warning.main">
                {(totalEmails - delivered - failed).toLocaleString()}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Total Volume
              </Typography>
              <Typography variant="h6" color="primary.main">
                {totalEmails.toLocaleString()}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default EmailFlowSankey;