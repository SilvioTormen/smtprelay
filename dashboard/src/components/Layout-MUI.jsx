import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext-Debug';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CssBaseline,
  Tooltip,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  Badge,
  Stack,
  Button,
  Paper
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  DevicesOther as DevicesIcon,
  Email as EmailIcon,
  Description as LogsIcon,
  Security as SecurityIcon,
  Shield as ShieldIcon,
  Lock as SessionsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Circle as CircleIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Cloud as CloudIcon,
  VpnLock as VpnLockIcon,
  AccountCircle as AccountIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Notifications as NotificationsIcon,
  ExpandMore as ExpandMoreIcon,
  WifiTethering as SignalIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const drawerWidth = 240;
const drawerWidthCollapsed = 65;

const Layout = ({ darkMode, toggleDarkMode }) => {
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/analytics', name: 'Analytics', icon: <AnalyticsIcon /> },
    { path: '/devices', name: 'Devices', icon: <DevicesIcon /> },
    { path: '/queue', name: 'Queue', icon: <EmailIcon /> },
    { path: '/logs', name: 'Logs', icon: <LogsIcon /> },
    { path: '/security', name: 'Security', icon: <ShieldIcon /> },
    { path: '/ip-whitelist', name: 'IP Whitelist', icon: <VpnLockIcon /> },
    { path: '/sessions', name: 'Sessions', icon: <SessionsIcon /> },
    ...(user?.role === 'admin' ? [{ path: '/users', name: 'User Management', icon: <PeopleIcon /> }] : []),
    { path: '/exchange-setup', name: 'Exchange Setup', icon: <CloudIcon /> },
    { path: '/settings', name: 'Settings', icon: <SettingsIcon /> },
  ];

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleLogout = async () => {
    try {
      // Call logout API
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Clear session and navigate
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
      
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${open ? drawerWidth : drawerWidthCollapsed}px)`,
          ml: `${open ? drawerWidth : drawerWidthCollapsed}px`,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            {open ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.name || 'SMTP Relay'}
          </Typography>
          
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Connection Status */}
            <Paper
              sx={{
                px: 1.5,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: theme.palette.mode === 'dark' 
                  ? 'rgba(76, 175, 80, 0.15)' 
                  : 'rgba(76, 175, 80, 0.1)',
                border: '1px solid',
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(76, 175, 80, 0.3)'
                  : 'rgba(76, 175, 80, 0.2)',
                borderRadius: 2
              }}
            >
              <SignalIcon 
                sx={{ 
                  fontSize: 18, 
                  animation: 'pulse 2s infinite',
                  color: theme.palette.mode === 'dark' 
                    ? '#4caf50' 
                    : 'success.main'
                }} 
              />
              <Typography 
                variant="caption" 
                fontWeight="medium"
                sx={{
                  color: theme.palette.mode === 'dark' 
                    ? '#4caf50' 
                    : 'success.main'
                }}
              >
                ONLINE
              </Typography>
            </Paper>
            
            {/* Date and Time */}
            <Paper
              sx={{
                px: 2,
                py: 0.5,
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 1,
                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                borderRadius: 2
              }}
            >
              <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Typography>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {new Date().toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit'
                })}
              </Typography>
            </Paper>
            
            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton 
                color="inherit"
                onClick={(e) => setNotificationAnchor(e.currentTarget)}
                sx={{
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.200'
                  }
                }}
              >
                <Badge badgeContent={2} color="error">
                  <NotificationsIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            
            {/* Theme Toggle */}
            <Tooltip title="Toggle theme">
              <IconButton 
                onClick={toggleDarkMode} 
                color="inherit"
                sx={{
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.200'
                  }
                }}
              >
                {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            
            {/* User Menu */}
            <Button
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.200'
                },
                textTransform: 'none'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar 
                  sx={{ 
                    width: 28, 
                    height: 28, 
                    bgcolor: 'primary.main',
                    fontSize: '0.875rem'
                  }}
                >
                  {user?.username?.charAt(0).toUpperCase() || 'A'}
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="body2" fontWeight="medium" color="text.primary">
                    {user?.displayName || user?.username || 'Admin'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.role || 'Administrator'}
                  </Typography>
                </Box>
                <ExpandMoreIcon fontSize="small" />
              </Stack>
            </Button>
            
            {/* User Dropdown Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 200,
                  borderRadius: 2
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {user?.displayName || user?.username || 'Admin'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email || `${user?.username || 'admin'}@smtp-relay.local`}
                </Typography>
              </Box>
              <MenuItem 
                component={Link} 
                to="/profile"
                onClick={() => setAnchorEl(null)}
              >
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                My Profile
              </MenuItem>
              <MenuItem 
                component={Link} 
                to="/settings"
                onClick={() => setAnchorEl(null)}
              >
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                Settings
              </MenuItem>
              <Divider />
              <MenuItem 
                onClick={() => {
                  setAnchorEl(null);
                  handleLogout();
                }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon>
                  <LogoutIcon fontSize="small" color="error" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
            
            {/* Notifications Menu */}
            <Menu
              anchorEl={notificationAnchor}
              open={Boolean(notificationAnchor)}
              onClose={() => setNotificationAnchor(null)}
              PaperProps={{
                sx: {
                  mt: 1,
                  width: 320,
                  borderRadius: 2
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Notifications
                </Typography>
              </Box>
              <MenuItem onClick={() => setNotificationAnchor(null)}>
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    System Update Available
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Version 1.2.0 is ready to install
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={() => setNotificationAnchor(null)}>
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Queue Processing Complete
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    15 emails sent successfully
                  </Typography>
                </Box>
              </MenuItem>
              <Divider />
              <Box sx={{ p: 1 }}>
                <Button fullWidth size="small">
                  View All Notifications
                </Button>
              </Box>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>
      
      {/* Drawer */}
      <Drawer
        sx={{
          width: open ? drawerWidth : drawerWidthCollapsed,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? drawerWidth : drawerWidthCollapsed,
            boxSizing: 'border-box',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: open ? 'flex-start' : 'center',
          p: 2,
          minHeight: 64,
        }}>
          <EmailIcon sx={{ fontSize: 32, color: 'primary.main', mr: open ? 1 : 0 }} />
          {open && (
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              SMTP Relay
            </Typography>
          )}
        </Box>
        
        <Divider />
        
        <List sx={{ flexGrow: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={location.pathname === item.path}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  },
                }}
              >
                <Tooltip title={!open ? item.name : ''} placement="right">
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 3 : 'auto',
                      justifyContent: 'center',
                      color: location.pathname === item.path ? 'primary.main' : 'inherit',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                </Tooltip>
                {open && (
                  <ListItemText 
                    primary={item.name}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: location.pathname === item.path ? 'medium' : 'regular',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        
        <Divider />
        
        <List>
          <ListItem disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              component={Link}
              to="/profile"
              selected={location.pathname === '/profile'}
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
                '&.Mui-selected': {
                  backgroundColor: 'action.selected',
                },
              }}
            >
              <Tooltip title={!open ? 'Profile' : ''} placement="right">
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <PersonIcon />
                </ListItemIcon>
              </Tooltip>
              {open && (
                <ListItemText 
                  primary="Profile"
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: 'medium',
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
                color: 'error.main',
                '&:hover': {
                  backgroundColor: (theme) => 
                    theme.palette.mode === 'dark' 
                      ? 'rgba(244, 67, 54, 0.08)'
                      : 'rgba(244, 67, 54, 0.08)',
                },
              }}
            >
              <Tooltip title={!open ? 'Logout' : ''} placement="right">
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                    color: 'error.main',
                  }}
                >
                  <LogoutIcon />
                </ListItemIcon>
              </Tooltip>
              {open && (
                <ListItemText 
                  primary="Logout"
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: 'medium',
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      
      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          width: `calc(100% - ${open ? drawerWidth : drawerWidthCollapsed}px)`,
          minHeight: '100vh',
          mt: 8, // Account for AppBar height
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;