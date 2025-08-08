import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Schedule as PendingIcon,
  PlayArrow as InProgressIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

const SetupProgressTracker = ({ 
  steps, 
  progress = {}, 
  errors = [], 
  warnings = [],
  showDetails = true,
  onRetry,
  className 
}) => {
  const [expandedErrors, setExpandedErrors] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState(false);

  const getStepStatus = (step) => {
    const stepProgress = progress[step];
    if (!stepProgress) return 'pending';
    return stepProgress.status || 'pending';
  };

  const getStepMessage = (step) => {
    const stepProgress = progress[step];
    return stepProgress?.message || '';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'complete':
        return <CheckIcon color="success" />;
      case 'error':
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'in_progress':
      case 'running':
        return <InProgressIcon color="primary" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'complete':
        return 'success';
      case 'error':
      case 'failed':
        return 'error';
      case 'in_progress':
      case 'running':
        return 'primary';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const calculateOverallProgress = () => {
    const completedSteps = steps.filter(step => {
      const status = getStepStatus(step);
      return status === 'completed' || status === 'complete';
    }).length;
    
    const inProgressSteps = steps.filter(step => {
      const status = getStepStatus(step);
      return status === 'in_progress' || status === 'running';
    }).length;
    
    return ((completedSteps + inProgressSteps * 0.5) / steps.length) * 100;
  };

  const hasActiveProgress = Object.values(progress).some(p => 
    p.status === 'in_progress' || p.status === 'running'
  );

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <Box className={className}>
      {/* Overall Progress */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Setup Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(calculateOverallProgress())}% Complete
            </Typography>
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={calculateOverallProgress()}
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />
          
          {hasActiveProgress && (
            <Box display="flex" alignItems="center">
              <InProgressIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="body2" color="primary">
                Setup in progress...
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Error Summary */}
      {hasErrors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>
            Setup Errors ({errors.length})
            <IconButton
              size="small"
              onClick={() => setExpandedErrors(!expandedErrors)}
              sx={{ ml: 1 }}
            >
              {expandedErrors ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </AlertTitle>
          
          <Collapse in={expandedErrors}>
            <List dense>
              {errors.map((error, index) => (
                <ListItem key={index} sx={{ pl: 0 }}>
                  <ListItemIcon>
                    <ErrorIcon color="error" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={error.message || error}
                    secondary={error.details}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Alert>
      )}

      {/* Warning Summary */}
      {hasWarnings && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>
            Setup Warnings ({warnings.length})
            <IconButton
              size="small"
              onClick={() => setExpandedWarnings(!expandedWarnings)}
              sx={{ ml: 1 }}
            >
              {expandedWarnings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </AlertTitle>
          
          <Collapse in={expandedWarnings}>
            <List dense>
              {warnings.map((warning, index) => (
                <ListItem key={index} sx={{ pl: 0 }}>
                  <ListItemIcon>
                    <WarningIcon color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={warning.message || warning}
                    secondary={warning.details}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Alert>
      )}

      {/* Detailed Steps */}
      {showDetails && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Setup Steps
            </Typography>
            
            <List>
              {steps.map((step, index) => {
                const status = getStepStatus(step);
                const message = getStepMessage(step);
                
                return (
                  <ListItem key={step} divider={index < steps.length - 1}>
                    <ListItemIcon>
                      {getStatusIcon(status)}
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">
                            {step}
                          </Typography>
                          <Chip
                            label={status.replace('_', ' ').toUpperCase()}
                            size="small"
                            color={getStatusColor(status)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={message}
                    />
                    
                    {status === 'in_progress' && (
                      <Box sx={{ width: 100, ml: 2 }}>
                        <LinearProgress />
                      </Box>
                    )}
                  </ListItem>
                );
              })}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default SetupProgressTracker;