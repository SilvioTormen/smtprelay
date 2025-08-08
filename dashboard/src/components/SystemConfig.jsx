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
  AlertTitle,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Button,
  Badge,
  useTheme,
  alpha,
  Skeleton,
  Fade,
  Grow,
  Zoom,
  Collapse,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  AvatarGroup,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tab,
  Tabs,
  Rating
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
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
  Code,
  Settings as ServiceIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  CloudQueue as CloudIcon,
  Email as EmailIcon,
  VpnKey as CertIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  DataUsage as DataIcon,
  Dns as DnsIcon,
  Router as RouterIcon,
  Wifi as WifiIcon,
  SignalCellularAlt as SignalIcon,
  BatteryFull as PowerIcon,
  Thermostat as TempIcon,
  LocalFireDepartment as FireIcon,
  AcUnit as CoolIcon,
  ExpandMore as ExpandMoreIcon,
  Dashboard as DashboardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Bolt as BoltIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  AdminPanelSettings as AdminIcon,
  Public as PublicIcon,
  VpnLock as VpnIcon,
  CloudSync as CloudSyncIcon,
  CloudOff as CloudOffIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Replay as RestartIcon,
  MoreVert as MoreIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Terminal as TerminalIcon,
  BugReport as BugIcon,
  CheckCircleOutline,
  HighlightOff,
  Info as InfoIcon,
  ArrowUpward,
  ArrowDownward,
  SyncAlt,
  DeviceHub,
  Grain,
  Layers,
  ViewInAr,
  AccountTree,
  Hub,
  Biotech,
  Psychology,
  Radar,
  CrisisAlert,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';
import { useSnackbar } from 'notistack';

const MotionCard = motion(Card);
const MotionBox = motion(Box);
const MotionPaper = motion(Paper);

// Custom animated circular progress with advanced design
const AnimatedCircularProgress = ({ value, size = 120, thickness = 8, color = 'primary', children }) => {
  const theme = useTheme();
  const [isAnimating, setIsAnimating] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 2000);
    return () => clearTimeout(timer);
  }, []);
  
  const getGradientColors = () => {
    if (value >= 80) {
      return {
        primary: ['#10b981', '#34d399', '#6ee7b7'],
        secondary: ['#22c55e', '#4ade80', '#86efac'],
        glow: 'rgba(52, 211, 153, 0.6)',
        background: 'rgba(16, 185, 129, 0.08)',
        particles: '#10b981'
      };
    } else if (value >= 60) {
      return {
        primary: ['#f59e0b', '#fbbf24', '#fcd34d'],
        secondary: ['#f97316', '#fb923c', '#fdba74'],
        glow: 'rgba(251, 191, 36, 0.6)',
        background: 'rgba(245, 158, 11, 0.08)',
        particles: '#f59e0b'
      };
    } else {
      return {
        primary: ['#ef4444', '#f87171', '#fca5a5'],
        secondary: ['#dc2626', '#f87171', '#fbbf24'],
        glow: 'rgba(239, 68, 68, 0.6)',
        background: 'rgba(220, 38, 38, 0.08)',
        particles: '#ef4444'
      };
    }
  };
  
  const colors = getGradientColors();
  const gradientId = `health-gradient-${Math.random().toString(36).substr(2, 9)}`;
  const glowId = `health-glow-${Math.random().toString(36).substr(2, 9)}`;
  const patternId = `health-pattern-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate multiple ring radii for layered effect
  const outerRadius = (size - thickness) / 2;
  const middleRadius = outerRadius - thickness / 2;
  const innerRadius = outerRadius - thickness;
  
  return (
    <Box 
      position="relative" 
      display="inline-flex"
      sx={{
        transform: isAnimating ? 'scale(0.9)' : 'scale(1)',
        transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Animated background particles */}
      <Box
        sx={{
          position: 'absolute',
          width: size + 40,
          height: size + 40,
          left: -20,
          top: -20,
          borderRadius: '50%',
          overflow: 'hidden',
          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: colors.particles,
            animation: 'float 6s infinite ease-in-out',
          },
          '&::before': {
            left: '20%',
            animationDelay: '0s',
          },
          '&::after': {
            right: '20%',
            animationDelay: '3s',
          },
          '@keyframes float': {
            '0%, 100%': {
              transform: 'translateY(0) translateX(0)',
              opacity: 0,
            },
            '10%': {
              opacity: 1,
            },
            '90%': {
              opacity: 1,
            },
            '50%': {
              transform: 'translateY(-20px) translateX(10px)',
            },
          },
        }}
      />
      
      {/* Main SVG with multiple layers */}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          {/* Advanced gradient with multiple stops */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary[0]}>
              <animate attributeName="stop-color" values={`${colors.primary[0]};${colors.primary[1]};${colors.primary[0]}`} dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor={colors.primary[1]}>
              <animate attributeName="stop-color" values={`${colors.primary[1]};${colors.primary[2]};${colors.primary[1]}`} dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={colors.primary[2]}>
              <animate attributeName="stop-color" values={`${colors.primary[2]};${colors.primary[0]};${colors.primary[2]}`} dur="3s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Glow filter */}
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Pattern for texture */}
          <pattern id={patternId} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.5" fill={alpha(colors.primary[1], 0.3)} />
          </pattern>
        </defs>
        
        {/* Outer decorative ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius + 4}
          fill="none"
          stroke={alpha(colors.primary[1], 0.1)}
          strokeWidth="1"
          strokeDasharray="2 4"
          opacity="0.5"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${size/2} ${size/2}`}
            to={`360 ${size/2} ${size/2}`}
            dur="60s"
            repeatCount="indefinite"
          />
        </circle>
        
        {/* Background track with pattern */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius}
          fill="none"
          stroke={theme.palette.mode === 'dark' ? alpha(theme.palette.grey[800], 0.3) : alpha(theme.palette.grey[200], 0.5)}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius}
          fill="none"
          stroke={`url(#${patternId})`}
          strokeWidth={thickness}
          opacity="0.3"
        />
        
        {/* Secondary progress ring (subtle) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius}
          fill="none"
          stroke={alpha(colors.secondary[1], 0.2)}
          strokeWidth={thickness + 2}
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * outerRadius}`}
          strokeDashoffset={`${2 * Math.PI * outerRadius * (1 - value / 100)}`}
          style={{
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `blur(4px)`,
          }}
        />
        
        {/* Main progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * outerRadius}`}
          strokeDashoffset={`${2 * Math.PI * outerRadius * (1 - value / 100)}`}
          filter={`url(#${glowId})`}
          style={{
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 ${thickness}px ${colors.glow})`,
          }}
        />
        
        {/* Progress end cap dot */}
        <circle
          cx={size / 2 + outerRadius * Math.cos((value / 100) * 2 * Math.PI - Math.PI / 2)}
          cy={size / 2 + outerRadius * Math.sin((value / 100) * 2 * Math.PI - Math.PI / 2)}
          r="4"
          fill={colors.primary[0]}
          style={{
            filter: `drop-shadow(0 0 8px ${colors.glow})`,
            transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
        </circle>
        
        {/* Inner decorative elements */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerRadius - 4}
          fill="none"
          stroke={alpha(colors.primary[1], 0.1)}
          strokeWidth="0.5"
          strokeDasharray="1 3"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`360 ${size/2} ${size/2}`}
            to={`0 ${size/2} ${size/2}`}
            dur="45s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      
      {/* Center content with enhanced background */}
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
          flexDirection: 'column'
        }}
      >
        <Box
          sx={{
            width: innerRadius * 2 - 8,
            height: innerRadius * 2 - 8,
            borderRadius: '50%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            background: theme.palette.mode === 'dark'
              ? `radial-gradient(circle at 30% 30%, ${alpha(colors.primary[0], 0.15)}, transparent 50%),
                 radial-gradient(circle at 70% 70%, ${alpha(colors.secondary[0], 0.1)}, transparent 50%),
                 radial-gradient(circle, ${colors.background}, transparent)`
              : `radial-gradient(circle at 30% 30%, ${alpha(colors.primary[0], 0.08)}, transparent 50%),
                 radial-gradient(circle at 70% 70%, ${alpha(colors.secondary[0], 0.05)}, transparent 50%),
                 ${colors.background}`,
            backdropFilter: 'blur(10px)',
            boxShadow: `inset 0 0 20px ${alpha(colors.primary[1], 0.1)}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: -1,
              borderRadius: '50%',
              padding: 1,
              background: `linear-gradient(135deg, ${alpha(colors.primary[0], 0.3)}, transparent)`,
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
            }
          }}
        >
          {children}
        </Box>
      </Box>
      
      {/* Orbiting particles */}
      {[0, 120, 240].map((angle, index) => (
        <Box
          key={index}
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            animation: `orbit ${10 + index * 2}s linear infinite`,
            '@keyframes orbit': {
              from: { transform: `rotate(${angle}deg)` },
              to: { transform: `rotate(${angle + 360}deg)` }
            }
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: colors.particles,
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: `0 0 6px ${colors.glow}`,
              opacity: 0.6 + index * 0.2,
            }}
          />
        </Box>
      ))}
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
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // cards, list, compact
  const [expandedSections, setExpandedSections] = useState({
    system: true,
    resources: true,
    network: true,
    security: true
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [selectedMetric, setSelectedMetric] = useState('overview');

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchSystemInfo, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

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

  const getHealthScore = () => {
    if (!systemInfo) return 0;
    let score = 100;
    
    // Memory usage penalty
    if (systemInfo.memory) {
      const memUsage = (systemInfo.memory.used / systemInfo.memory.total) * 100;
      if (memUsage > 80) score -= 20;
      else if (memUsage > 60) score -= 10;
    }
    
    // Disk usage penalty
    if (systemInfo.disk) {
      const diskUsage = (systemInfo.disk.used / systemInfo.disk.total) * 100;
      if (diskUsage > 80) score -= 20;
      else if (diskUsage > 60) score -= 10;
    }
    
    // Service status penalty
    if (systemInfo.services) {
      Object.values(systemInfo.services).forEach(status => {
        if (status !== 'active' && status !== 'running') score -= 15;
      });
    }
    
    return Math.max(0, score);
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
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

  if (error && !systemInfo) {
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
        {error}
      </Alert>
    );
  }

  const healthScore = getHealthScore();

  return (
    <Box>
      {/* Header with controls */}
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
          <Grid item xs={12} md={6}>
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
                  System Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {systemInfo?.hostname || 'Loading...'} • Last updated: {new Date().toLocaleTimeString()}
                </Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box display="flex" justifyContent="flex-end" alignItems="center" gap={2}>
              <AnimatedCircularProgress 
                value={healthScore} 
                size={180}
                thickness={14}
                color={getHealthColor(healthScore)}
              >
                <Box sx={{ textAlign: 'center', position: 'relative' }}>
                  {/* Animated icon with layered effects */}
                  <Box sx={{ mb: 0, position: 'relative', height: 32 }}>
                    {healthScore >= 80 ? (
                      <Box sx={{ position: 'relative' }}>
                        <CheckCircleOutline 
                          sx={{ 
                            fontSize: 32, 
                            color: '#10b981',
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3))',
                            animation: 'bounceIcon 3s ease-in-out infinite',
                            '@keyframes bounceIcon': {
                              '0%, 100%': { 
                                transform: 'translateX(-50%) translateY(0) scale(1)',
                              },
                              '50%': { 
                                transform: 'translateX(-50%) translateY(-2px) scale(1.1)',
                              }
                            }
                          }} 
                        />
                        <CheckCircleOutline 
                          sx={{ 
                            fontSize: 32, 
                            color: '#10b981',
                            opacity: 0.3,
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            filter: 'blur(3px)',
                            animation: 'pulseIcon 3s ease-in-out infinite',
                            '@keyframes pulseIcon': {
                              '0%, 100%': { 
                                transform: 'translateX(-50%) scale(1)',
                                opacity: 0
                              },
                              '50%': { 
                                transform: 'translateX(-50%) scale(1.3)',
                                opacity: 0.3
                              }
                            }
                          }} 
                        />
                      </Box>
                    ) : healthScore >= 60 ? (
                      <Box sx={{ position: 'relative' }}>
                        <WarningIcon 
                          sx={{ 
                            fontSize: 32, 
                            color: '#f59e0b',
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3))',
                            animation: 'pulseWarn 2s ease-in-out infinite',
                            '@keyframes pulseWarn': {
                              '0%, 100%': { 
                                transform: 'translateX(-50%) scale(1)',
                                opacity: 1
                              },
                              '50%': { 
                                transform: 'translateX(-50%) scale(1.05)',
                                opacity: 0.8
                              }
                            }
                          }} 
                        />
                      </Box>
                    ) : (
                      <Box sx={{ position: 'relative' }}>
                        <ErrorIcon 
                          sx={{ 
                            fontSize: 32, 
                            color: '#ef4444',
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))',
                            animation: 'shakeIcon 2s ease-in-out infinite',
                            '@keyframes shakeIcon': {
                              '0%, 100%': { transform: 'translateX(-50%) rotate(0deg)' },
                              '10%': { transform: 'translateX(-52%) rotate(-5deg)' },
                              '20%': { transform: 'translateX(-48%) rotate(5deg)' },
                              '30%': { transform: 'translateX(-52%) rotate(-5deg)' },
                              '40%': { transform: 'translateX(-48%) rotate(5deg)' },
                              '50%': { transform: 'translateX(-50%) rotate(0deg)' }
                            }
                          }} 
                        />
                      </Box>
                    )}
                  </Box>
                  
                  {/* Score display with enhanced styling */}
                  <Box sx={{ position: 'relative', mt: 1 }}>
                    <Typography 
                      variant="h2" 
                      fontWeight="900"
                      sx={{
                        background: healthScore >= 80 
                          ? 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)'
                          : healthScore >= 60
                          ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)'
                          : 'linear-gradient(135deg, #ef4444 0%, #f87171 50%, #fca5a5 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        color: 'transparent',
                        lineHeight: 1,
                        letterSpacing: '-2px',
                        fontSize: '3.5rem',
                        fontFamily: '"Inter", "Roboto", sans-serif',
                        position: 'relative',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background: 'inherit',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          filter: 'blur(10px)',
                          opacity: 0.3,
                          zIndex: -1,
                        }
                      }}
                    >
                      {healthScore}
                      <Typography
                        component="span"
                        sx={{
                          fontSize: '0.5em',
                          background: 'inherit',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          fontWeight: 700,
                          ml: 0.2
                        }}
                      >
                        %
                      </Typography>
                    </Typography>
                  </Box>
                  
                  {/* Status text with animated underline */}
                  <Box sx={{ position: 'relative', mt: 0.5 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444',
                        fontSize: '0.75rem',
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        display: 'inline-block',
                        fontWeight: 600,
                        position: 'relative',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          bottom: -2,
                          left: 0,
                          right: 0,
                          height: 1,
                          background: healthScore >= 80 
                            ? 'linear-gradient(90deg, transparent, #10b981, transparent)'
                            : healthScore >= 60
                            ? 'linear-gradient(90deg, transparent, #f59e0b, transparent)'
                            : 'linear-gradient(90deg, transparent, #ef4444, transparent)',
                          animation: 'slideUnderline 3s ease-in-out infinite',
                          '@keyframes slideUnderline': {
                            '0%, 100%': { 
                              transform: 'translateX(-100%)',
                              opacity: 0
                            },
                            '50%': { 
                              transform: 'translateX(0)',
                              opacity: 1
                            }
                          }
                        }
                      }}
                    >
                      {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention'}
                    </Typography>
                  </Box>
                </Box>
              </AnimatedCircularProgress>
              
              <Stack direction="row" spacing={1} sx={{ position: 'relative', zIndex: 10 }}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, newMode) => {
                    if (newMode !== null) {
                      setViewMode(newMode);
                      enqueueSnackbar(`Switched to ${newMode} view`, { variant: 'info' });
                    }
                  }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                      '&:hover': {
                        background: alpha(theme.palette.primary.main, 0.1)
                      },
                      '&.Mui-selected': {
                        background: alpha(theme.palette.primary.main, 0.2),
                        borderColor: theme.palette.primary.main,
                        '&:hover': {
                          background: alpha(theme.palette.primary.main, 0.3)
                        }
                      }
                    }
                  }}
                >
                  <ToggleButton value="cards" aria-label="Cards view">
                    <Tooltip title="Cards View">
                      <DashboardIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="list" aria-label="List view">
                    <Tooltip title="List View">
                      <ViewInAr />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="compact" aria-label="Compact view">
                    <Tooltip title="Compact View">
                      <Layers />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
                
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
                    sx={{
                      background: autoRefresh ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.primary.main, autoRefresh ? 0.5 : 0.2)}`,
                      '&:hover': {
                        background: alpha(theme.palette.primary.main, autoRefresh ? 0.3 : 0.1),
                        borderColor: theme.palette.primary.main
                      }
                    }}
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
                    sx={{
                      background: alpha(theme.palette.primary.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      '&:hover': {
                        background: alpha(theme.palette.primary.main, 0.1),
                        borderColor: theme.palette.primary.main,
                        transform: 'rotate(180deg)',
                        transition: 'all 0.3s ease'
                      },
                      '&:disabled': {
                        opacity: 0.5
                      }
                    }}
                  >
                    {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </MotionPaper>

      {/* Quick Stats Bar */}
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
            <MotionCard
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
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
            </MotionCard>
          </Grid>
        ))}
      </Grid>

      {/* Main Content Grid - Dynamic based on viewMode */}
      <Grid container spacing={viewMode === 'compact' ? 1 : viewMode === 'list' ? 2 : 3}>
        {/* System Overview */}
        <Grid item xs={12} lg={viewMode === 'list' ? 12 : 6}>
          <MotionCard
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            elevation={3}
            sx={{ borderRadius: 3, overflow: 'visible' }}
          >
            <CardContent sx={{ p: viewMode === 'compact' ? 2 : 3 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={viewMode === 'compact' ? 1 : 2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: viewMode === 'compact' ? 28 : 32, height: viewMode === 'compact' ? 28 : 32 }}>
                    <SystemIcon fontSize={viewMode === 'compact' ? "extra-small" : "small"} />
                  </Avatar>
                  <Typography variant={viewMode === 'compact' ? "subtitle1" : "h6"} fontWeight="bold">
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
                <Stack spacing={2}>
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
                        border: `1px solid ${theme.palette.divider}`,
                        transition: 'all 0.3s',
                        '&:hover': {
                          background: alpha(theme.palette.primary.main, 0.05),
                          borderColor: theme.palette.primary.main
                        }
                      }}
                    >
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.light' }}>
                            {item.icon}
                          </Avatar>
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
          </MotionCard>
        </Grid>

        {/* Resource Usage */}
        <Grid item xs={12} lg={viewMode === 'list' ? 12 : 6}>
          <MotionCard
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            elevation={3}
            sx={{ borderRadius: 3 }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                    <DataIcon fontSize="small" />
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
                    <Box display="flex" alignItems="center" gap={1}>
                      <MemoryIcon fontSize="small" color="primary" />
                      <Typography variant="subtitle2">Memory Usage</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {systemInfo?.memory ? 
                        `${formatBytes(systemInfo.memory.used)} / ${formatBytes(systemInfo.memory.total)}` 
                        : 'Unknown'}
                    </Typography>
                  </Box>
                  <Box sx={{ position: 'relative' }}>
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
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {systemInfo?.memory ? `${Math.round((systemInfo.memory.used / systemInfo.memory.total) * 100)}%` : ''}
                    </Box>
                  </Box>
                  {systemInfo?.memory?.free && (
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(systemInfo.memory.free)} available
                    </Typography>
                  )}
                </Box>

                {/* Disk Usage */}
                <Box mb={3}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <StorageIcon fontSize="small" color="secondary" />
                      <Typography variant="subtitle2">Disk Usage</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {systemInfo?.disk ? 
                        `${formatBytes(systemInfo.disk.used)} / ${formatBytes(systemInfo.disk.total)}` 
                        : 'Unknown'}
                    </Typography>
                  </Box>
                  <Box sx={{ position: 'relative' }}>
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
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {systemInfo?.disk ? `${Math.round((systemInfo.disk.used / systemInfo.disk.total) * 100)}%` : ''}
                    </Box>
                  </Box>
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
          </MotionCard>
        </Grid>

        {/* Services & Network */}
        <Grid item xs={12}>
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            elevation={3}
            sx={{ borderRadius: 3 }}
          >
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
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Radar fontSize="small" />
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
                            border: `1px solid ${theme.palette.divider}`,
                            transition: 'all 0.3s',
                            '&:hover': {
                              transform: 'translateX(4px)',
                              borderColor: theme.palette.primary.main
                            }
                          }}
                        >
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box display="flex" alignItems="center" gap={2}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                                {service.icon}
                              </Avatar>
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
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PublicIcon fontSize="small" />
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
          </MotionCard>
        </Grid>

        {/* Security & Configuration */}
        <Grid item xs={12}>
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            elevation={3}
            sx={{ borderRadius: 3 }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}>
                    <ShieldIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="h6" fontWeight="bold">
                    Security & Configuration
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleSection('security')}>
                  <ExpandMoreIcon sx={{ 
                    transform: expandedSections.security ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }} />
                </IconButton>
              </Box>
              
              <Collapse in={expandedSections.security}>
                <Grid container spacing={3}>
                  {[
                    {
                      title: 'TLS Certificate',
                      value: systemInfo?.tls?.status || 'Not configured',
                      icon: <CertIcon />,
                      status: systemInfo?.tls?.valid ? 'success' : 'warning',
                      badge: systemInfo?.tls?.daysUntilExpiry ? `${systemInfo.tls.daysUntilExpiry} days` : null
                    },
                    {
                      title: 'IP Whitelisting',
                      value: systemInfo?.security?.ipWhitelist ? 'Enabled' : 'Disabled',
                      icon: <VpnIcon />,
                      status: systemInfo?.security?.ipWhitelist ? 'success' : 'info',
                      badge: systemInfo?.security?.ipWhitelistCount || '0'
                    },
                    {
                      title: 'MFA Status',
                      value: systemInfo?.security?.mfa ? 'Enabled' : 'Disabled',
                      icon: <LockIcon />,
                      status: systemInfo?.security?.mfa ? 'success' : 'warning',
                      badge: null
                    },
                    {
                      title: 'Exchange Online',
                      value: systemInfo?.exchange?.configured ? 'Configured' : 'Not configured',
                      icon: <CloudSyncIcon />,
                      status: systemInfo?.exchange?.configured ? 'success' : 'info',
                      badge: systemInfo?.exchange?.accounts ? `${systemInfo.exchange.accounts} accounts` : null
                    },
                    {
                      title: 'Queue Status',
                      value: `${systemInfo?.queue?.count || 0} items`,
                      icon: <DirectoryIcon />,
                      status: systemInfo?.queue?.count > 100 ? 'warning' : 'success',
                      badge: systemInfo?.queue?.size ? formatBytes(systemInfo.queue.size) : null
                    },
                    {
                      title: 'Log Files',
                      value: systemInfo?.logs?.size ? formatBytes(systemInfo.logs.size) : 'Unknown',
                      icon: <AssessmentIcon />,
                      status: systemInfo?.logs?.size > 1000000000 ? 'warning' : 'success',
                      badge: systemInfo?.logs?.count ? `${systemInfo.logs.count} files` : null
                    }
                  ].map((item, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Paper
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: `1px solid ${alpha(theme.palette[item.status].main, 0.3)}`,
                          background: alpha(theme.palette[item.status].main, 0.05),
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: `0 8px 24px ${alpha(theme.palette[item.status].main, 0.2)}`
                          }
                        }}
                      >
                        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar
                              sx={{
                                width: 40,
                                height: 40,
                                bgcolor: alpha(theme.palette[item.status].main, 0.1),
                                color: theme.palette[item.status].main
                              }}
                            >
                              {item.icon}
                            </Avatar>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {item.title}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {item.value}
                              </Typography>
                            </Box>
                          </Box>
                          {item.badge && (
                            <Chip
                              label={item.badge}
                              size="small"
                              color={item.status}
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Collapse>
            </CardContent>
          </MotionCard>
        </Grid>
      </Grid>

      {/* Floating Action Button for Quick Actions */}
      <SpeedDial
        ariaLabel="Quick Actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon icon={<SettingsIcon />} openIcon={<CloseIcon />} />}
      >
        <SpeedDialAction
          icon={<RefreshIcon />}
          tooltipTitle="Refresh"
          onClick={fetchSystemInfo}
        />
        <SpeedDialAction
          icon={<TerminalIcon />}
          tooltipTitle="System Logs"
          onClick={() => enqueueSnackbar('Opening system logs...', { variant: 'info' })}
        />
        <SpeedDialAction
          icon={<BugIcon />}
          tooltipTitle="Debug Info"
          onClick={() => enqueueSnackbar('Debug mode activated', { variant: 'info' })}
        />
      </SpeedDial>
    </Box>
  );
};

export default SystemConfig;