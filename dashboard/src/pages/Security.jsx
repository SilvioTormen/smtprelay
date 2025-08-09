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
  useTheme,
  alpha,
  Skeleton,
  Fade,
  Grow,
  Collapse,
  Badge,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield as ShieldIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  VpnLock as VpnIcon,
  VpnKey,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircleOutline,
  HighlightOff,
  AdminPanelSettings as AdminIcon,
  CloudSync as CloudSyncIcon,
  Cloud as CloudIcon,
  Timer as TimerIcon,
  Password as PasswordIcon,
  Domain as DomainIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
  Bolt as BoltIcon,
  Radar,
  Security as SecurityIcon,
  VerifiedUser as VerifiedUserIcon,
  GppGood as GppGoodIcon,
  GppBad as GppBadIcon,
  GppMaybe as GppMaybeIcon,
  Key as KeyIcon,
  LockOpen as LockOpenIcon,
  EnhancedEncryption,
  Https as HttpsIcon,
  Router as RouterIcon,
  Wifi as WifiIcon,
  VerifiedUser as CertIcon,
  Token as TokenIcon,
  ContentCopy as CopyIcon,
  Save as SaveIcon,
  PlayArrow as StartIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';
import { useSnackbar } from 'notistack';

const MotionCard = motion(Card);
const MotionBox = motion(Box);
const MotionPaper = motion(Paper);

// Reuse the AnimatedCircularProgress from SystemConfig
const AnimatedCircularProgress = ({ value, size = 120, thickness = 10, children }) => {
  const theme = useTheme();
  
  const getColor = () => {
    if (value >= 80) return theme.palette.success.main;
    if (value >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };
  
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress
        variant="determinate"
        value={value}
        size={size}
        thickness={thickness}
        sx={{
          color: getColor(),
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          }
        }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

// Status indicator with pulse animation
const StatusIndicator = ({ status, size = 'medium' }) => {
  const theme = useTheme();
  const getColor = () => {
    switch (status) {
      case 'online':
      case 'running':
      case 'active':
      case 'configured':
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
            animation: status === 'online' || status === 'configured' ? 'pulse 2s infinite' : 'none',
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

const Security = () => {
  const { apiRequest } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingSecrets, setGeneratingSecrets] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    if (!loading) setRefreshing(true);
    try {
      const [statusRes, recRes] = await Promise.all([
        apiRequest('/api/security/status'),
        apiRequest('/api/security/recommendations')
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSecurityStatus(statusData);
      }

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData);
      }
    } catch (err) {
      console.error('Error fetching security data:', err);
      enqueueSnackbar('Failed to load security information', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateSecrets = async () => {
    setGeneratingSecrets(true);
    try {
      const response = await apiRequest('/api/security/generate-secrets', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        enqueueSnackbar(result.message, { variant: 'success' });
        enqueueSnackbar(result.warning, { variant: 'warning', persist: true });
      } else {
        throw new Error('Failed to generate secrets');
      }
    } catch (err) {
      console.error('Error generating secrets:', err);
      enqueueSnackbar('Failed to generate security secrets', { variant: 'error' });
    } finally {
      setGeneratingSecrets(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'success' });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <MotionPaper
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
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
                badgeContent={<StatusIndicator status={securityStatus?.overall === 'excellent' ? 'online' : 'warning'} size="small" />}
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
                  <ShieldIcon fontSize="large" />
                </Avatar>
              </Badge>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  Security Center
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monitor and manage your SMTP Relay security configuration
                </Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box display="flex" justifyContent="flex-end" alignItems="center" gap={2}>
              <Button
                variant="contained"
                startIcon={<TokenIcon />}
                onClick={generateSecrets}
                disabled={generatingSecrets}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  }
                }}
              >
                {generatingSecrets ? 'Generating...' : 'Generate Secrets'}
              </Button>
              
              <Tooltip title="Refresh">
                <IconButton 
                  onClick={fetchSecurityData}
                  disabled={refreshing}
                  sx={{
                    background: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      background: alpha(theme.palette.primary.main, 0.2),
                    }
                  }}
                >
                  {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </MotionPaper>

      {securityStatus && (
        <>
          {/* Security Score Card */}
          <MotionPaper
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            elevation={2}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 3,
              background: theme.palette.mode === 'dark'
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.15)} 0%, ${alpha(theme.palette.secondary.dark, 0.15)} 100%)`
                : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.1)} 100%)`,
              border: `1px solid ${alpha(
                securityStatus.overall === 'excellent' ? theme.palette.success.main :
                securityStatus.overall === 'good' ? theme.palette.info.main :
                securityStatus.overall === 'fair' ? theme.palette.warning.main : theme.palette.error.main,
                0.3
              )}`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, 
                  ${securityStatus.overall === 'excellent' ? theme.palette.success.main :
                  securityStatus.overall === 'good' ? theme.palette.info.main :
                  securityStatus.overall === 'fair' ? theme.palette.warning.main : theme.palette.error.main} 0%, 
                  ${alpha(theme.palette.primary.main, 0.5)} 100%)`,
                animation: 'shimmer 3s infinite linear',
                '@keyframes shimmer': {
                  '0%': { transform: 'translateX(-100%)' },
                  '100%': { transform: 'translateX(100%)' }
                }
              }
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  Security Health Score
                </Typography>
                <Box display="flex" alignItems="baseline" gap={2}>
                  <Typography 
                    variant="h1" 
                    fontWeight="900"
                    sx={{
                      background: securityStatus.score >= 80 
                        ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                        : securityStatus.score >= 60
                        ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                        : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                      textShadow: `0 2px 10px ${alpha(
                        securityStatus.score >= 80 ? '#10b981' :
                        securityStatus.score >= 60 ? '#f59e0b' : '#ef4444',
                        0.3
                      )}`
                    }}
                  >
                    {securityStatus.score}%
                  </Typography>
                  <Box>
                    <Chip
                      label={securityStatus.overall.replace('_', ' ').toUpperCase()}
                      color={
                        securityStatus.overall === 'excellent' ? 'success' :
                        securityStatus.overall === 'good' ? 'info' :
                        securityStatus.overall === 'fair' ? 'warning' : 'error'
                      }
                      sx={{ fontWeight: 'bold', fontSize: '1rem' }}
                    />
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={securityStatus.score}
                  sx={{
                    mt: 2,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: alpha(theme.palette.grey[500], 0.2),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      background: securityStatus.score >= 80 
                        ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                        : securityStatus.score >= 60
                        ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
                        : 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <AnimatedCircularProgress 
                  value={securityStatus.score} 
                  size={150}
                  thickness={12}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    {securityStatus.score >= 80 ? 
                      <GppGoodIcon sx={{ fontSize: 50, color: '#10b981' }} /> :
                      securityStatus.score >= 60 ?
                      <GppMaybeIcon sx={{ fontSize: 50, color: '#f59e0b' }} /> :
                      <GppBadIcon sx={{ fontSize: 50, color: '#ef4444' }} />
                    }
                  </Box>
                </AnimatedCircularProgress>
              </Grid>
            </Grid>
          </MotionPaper>

          <Grid container spacing={3}>
            {/* Critical Security */}
            <Grid item xs={12} md={6}>
              <MotionCard
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                sx={{
                  borderRadius: 3,
                  background: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.error.dark, 0.05)
                    : alpha(theme.palette.error.light, 0.05),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${alpha(theme.palette.error.main, 0.15)}`
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Avatar sx={{ 
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                      width: 40,
                      height: 40
                    }}>
                      <LockIcon />
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight="bold">
                        Critical Security
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Essential security requirements
                      </Typography>
                    </Box>
                    <StatusIndicator 
                      status={securityStatus.critical.secrets.status === 'configured' ? 'configured' : 'error'} 
                    />
                  </Box>
                  
                  <Stack spacing={1.5}>
                    {[...securityStatus.critical.secrets.items, ...securityStatus.critical.authentication.items].map((item, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: alpha(theme.palette.background.default, 0.5),
                          border: `1px solid ${theme.palette.divider}`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateX(4px)',
                            borderColor: item.icon === 'check' ? theme.palette.success.main : theme.palette.error.main,
                            background: alpha(
                              item.icon === 'check' ? theme.palette.success.main : theme.palette.error.main,
                              0.05
                            )
                          }
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={1}>
                            {item.icon === 'check' ? 
                              <CheckCircleOutline sx={{ color: theme.palette.success.main, fontSize: 20 }} /> :
                              item.icon === 'warning' ?
                              <WarningIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} /> :
                              <HighlightOff sx={{ color: theme.palette.error.main, fontSize: 20 }} />
                            }
                            <Typography variant="body2" fontWeight="medium">
                              {item.name}
                            </Typography>
                          </Box>
                          <Chip 
                            size="small" 
                            label={item.value || item.status} 
                            color={item.icon === 'check' ? 'success' : item.icon === 'warning' ? 'warning' : 'error'}
                            variant="outlined"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </CardContent>
              </MotionCard>
            </Grid>
            
            {/* Network Security */}
            <Grid item xs={12} md={6}>
              <MotionCard
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                sx={{
                  borderRadius: 3,
                  background: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.dark, 0.05)
                    : alpha(theme.palette.primary.light, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Avatar sx={{ 
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      width: 40,
                      height: 40
                    }}>
                      <PublicIcon />
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight="bold">
                        Network Security
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Connection and transport security
                      </Typography>
                    </Box>
                    <StatusIndicator 
                      status={securityStatus.network.tls.status === 'configured' || 
                              securityStatus.network.proxy.status === 'configured' ? 'configured' : 'warning'} 
                    />
                  </Box>
                  
                  <Stack spacing={1.5}>
                    {[...securityStatus.network.tls.items, ...securityStatus.network.proxy.items].map((item, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: alpha(theme.palette.background.default, 0.5),
                          border: `1px solid ${theme.palette.divider}`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateX(4px)',
                            borderColor: item.icon === 'check' ? theme.palette.success.main : theme.palette.warning.main,
                            background: alpha(
                              item.icon === 'check' ? theme.palette.success.main : theme.palette.warning.main,
                              0.05
                            )
                          }
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={1}>
                            {item.name === 'TLS Certificate' ? 
                              <HttpsIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} /> :
                              item.name === 'Reverse Proxy' ?
                              <RouterIcon sx={{ color: theme.palette.info.main, fontSize: 20 }} /> :
                              item.name === 'IP Whitelist' ?
                              <VpnIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} /> :
                              <WifiIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
                            }
                            <Typography variant="body2" fontWeight="medium">
                              {item.name}
                            </Typography>
                          </Box>
                          <Chip 
                            size="small" 
                            label={item.value || item.status.replace('_', ' ')} 
                            color={item.icon === 'check' ? 'success' : 'warning'}
                            variant="outlined"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </CardContent>
              </MotionCard>
            </Grid>

            {/* Optional Features */}
            {(securityStatus.optional.mfa.items.length > 0 || 
              securityStatus.optional.webauthn.items.length > 0 ||
              securityStatus.optional.authentication?.items?.length > 0) && (
              <Grid item xs={12}>
                <MotionCard
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  sx={{
                    borderRadius: 3,
                    background: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.info.dark, 0.05)
                      : alpha(theme.palette.info.light, 0.05),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AutoAwesomeIcon sx={{ color: theme.palette.info.main }} />
                      Authentication & Optional Features
                    </Typography>
                    <Grid container spacing={2}>
                      {[
                        ...securityStatus.optional.mfa.items,
                        ...securityStatus.optional.webauthn.items,
                        ...(securityStatus.optional.authentication?.items || [])
                      ].map((item, index) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                          <Paper sx={{
                            p: 2,
                            borderRadius: 2,
                            background: alpha(theme.palette.background.default, 0.5),
                            border: `1px solid ${theme.palette.divider}`,
                            textAlign: 'center',
                            minHeight: 140,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            transition: 'all 0.3s',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              borderColor: item.icon === 'check' ? theme.palette.success.main : 
                                         item.icon === 'warning' ? theme.palette.warning.main : 
                                         theme.palette.info.main,
                              background: alpha(
                                item.icon === 'check' ? theme.palette.success.main : 
                                item.icon === 'warning' ? theme.palette.warning.main : 
                                theme.palette.info.main,
                                0.05
                              )
                            }
                          }}>
                            {/* Icon based on feature type */}
                            {item.name === 'Multi-Factor Auth' ? (
                              <AdminIcon sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                            ) : item.name === 'WebAuthn/FIDO2' ? (
                              <VpnKey sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                            ) : item.name === 'Session Timeout' ? (
                              <TimerIcon sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                            ) : item.name === 'Password Policy' ? (
                              <PasswordIcon sx={{ fontSize: 40, color: item.icon === 'check' ? theme.palette.success.main : theme.palette.warning.main, mb: 1 }} />
                            ) : item.name === 'Account Lockout' ? (
                              <LockOpenIcon sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                            ) : item.name === 'Azure AD SSO' ? (
                              <CloudIcon sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
                            ) : item.name === 'LDAP Integration' ? (
                              <DomainIcon sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
                            ) : (
                              <SecurityIcon sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                            )}
                            
                            <Typography variant="body2" fontWeight="bold">
                              {item.name}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={item.value || item.status.replace('_', ' ')} 
                              color={
                                item.icon === 'check' ? 'success' :
                                item.icon === 'warning' ? 'warning' : 'info'
                              }
                              variant="outlined"
                              sx={{ mt: 1, fontWeight: 'bold' }}
                            />
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </MotionCard>
              </Grid>
            )}

            {/* Recommendations */}
            {securityStatus.recommendations && securityStatus.recommendations.length > 0 && (
              <Grid item xs={12}>
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <Alert 
                    severity="info" 
                    sx={{ 
                      borderRadius: 3,
                      background: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.info.dark, 0.1)
                        : alpha(theme.palette.info.light, 0.1),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                      '& .MuiAlert-icon': {
                        fontSize: 28
                      }
                    }}
                    icon={<Radar sx={{ animation: 'pulse 2s infinite' }} />}
                  >
                    <AlertTitle sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                      Security Recommendations
                    </AlertTitle>
                    <Stack spacing={1} sx={{ mt: 2 }}>
                      {securityStatus.recommendations.map((rec, index) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1,
                            borderRadius: 1,
                            transition: 'all 0.3s',
                            '&:hover': {
                              background: alpha(theme.palette.info.main, 0.1),
                              transform: 'translateX(8px)'
                            }
                          }}
                        >
                          <BoltIcon sx={{ color: theme.palette.info.main, fontSize: 16 }} />
                          <Typography variant="body2">{rec}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Alert>
                </MotionBox>
              </Grid>
            )}

            {/* Detailed Recommendations */}
            {recommendations && recommendations.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                  Detailed Security Checklist
                </Typography>
                <Grid container spacing={2}>
                  {recommendations.map((category, catIndex) => (
                    <Grid item xs={12} md={6} key={catIndex}>
                      <MotionCard
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 + catIndex * 0.1 }}
                        sx={{
                          borderRadius: 2,
                          border: `1px solid ${
                            category.priority === 'high' ? alpha(theme.palette.error.main, 0.3) :
                            category.priority === 'medium' ? alpha(theme.palette.warning.main, 0.3) :
                            alpha(theme.palette.info.main, 0.3)
                          }`
                        }}
                      >
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <Chip
                              label={category.priority.toUpperCase()}
                              size="small"
                              color={
                                category.priority === 'high' ? 'error' :
                                category.priority === 'medium' ? 'warning' : 'info'
                              }
                            />
                            <Typography variant="h6" fontWeight="bold">
                              {category.category}
                            </Typography>
                          </Box>
                          <Stack spacing={1}>
                            {category.items.map((item, itemIndex) => (
                              <Box
                                key={itemIndex}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  p: 1,
                                  borderRadius: 1,
                                  background: alpha(theme.palette.background.default, 0.5),
                                  border: `1px solid ${theme.palette.divider}`
                                }}
                              >
                                {item.status === 'completed' ? 
                                  <CheckCircleOutline sx={{ color: theme.palette.success.main, fontSize: 20 }} /> :
                                  item.status === 'pending' ?
                                  <WarningIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} /> :
                                  <InfoIcon sx={{ color: theme.palette.info.main, fontSize: 20 }} />
                                }
                                <Box flex={1}>
                                  <Typography variant="body2" fontWeight="medium">
                                    {item.title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {item.description}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Stack>
                        </CardContent>
                      </MotionCard>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default Security;