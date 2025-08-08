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
  Lock as SessionsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Circle as CircleIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const drawerWidth = 240;
const drawerWidthCollapsed = 65;

const Layout = ({ darkMode, toggleDarkMode }) => {
  const [open, setOpen] = useState(true);
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
    { path: '/ip-whitelist', name: 'IP Whitelist', icon: <SecurityIcon /> },
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<CircleIcon sx={{ fontSize: 12 }} />}
              label="Connected"
              color="success"
              size="small"
              sx={{ 
                '& .MuiChip-icon': { 
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.3 },
                    '100%': { opacity: 1 },
                  }
                }
              }}
            />
            
            <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' } }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </Typography>
            
            <Tooltip title="Toggle theme">
              <IconButton onClick={toggleDarkMode} color="inherit">
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
            
            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
              A
            </Avatar>
          </Box>
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