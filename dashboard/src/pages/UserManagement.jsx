import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel,
  InputAdornment,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  VpnKey as KeyIcon,
  SecurityUpdate as SecurityIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  RemoveRedEye as ViewerIcon,
  Engineering as OperatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

const UserManagement = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'operator',
    permissions: []
  });
  const [errors, setErrors] = useState({});

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      enqueueSnackbar('Failed to load users', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!editMode || formData.username) {
      if (!formData.username) {
        newErrors.username = 'Username is required';
      } else if (!/^[a-zA-Z0-9_-]{3,50}$/.test(formData.username)) {
        newErrors.username = 'Username must be 3-50 characters (letters, numbers, _, -)';
      }
    }
    
    if (!editMode || formData.password) {
      if (!formData.password && !editMode) {
        newErrors.password = 'Password is required';
      } else if (formData.password && formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      
      if (formData.password && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      // First, fetch CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const { csrfToken } = await csrfResponse.json();
      
      const url = editMode ? `/api/users/${selectedUser.id}` : '/api/users';
      const method = editMode ? 'PUT' : 'POST';
      
      const body = {
        role: formData.role,
        permissions: formData.permissions
      };
      
      if (!editMode) {
        body.username = formData.username;
        body.password = formData.password;
      } else if (formData.password) {
        body.resetPassword = true;
        body.newPassword = formData.password;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Operation failed');
      }
      
      enqueueSnackbar(
        editMode ? 'User updated successfully' : 'User created successfully',
        { variant: 'success' }
      );
      
      handleCloseDialog();
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      // First, fetch CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }
      
      enqueueSnackbar('User deleted successfully', { variant: 'success' });
      setDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  };

  const handleUnlock = async (userId) => {
    try {
      // First, fetch CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ unlockAccount: true })
      });
      
      if (!response.ok) {
        throw new Error('Failed to unlock account');
      }
      
      enqueueSnackbar('Account unlocked successfully', { variant: 'success' });
      fetchUsers();
    } catch (error) {
      console.error('Error unlocking account:', error);
      enqueueSnackbar('Failed to unlock account', { variant: 'error' });
    }
  };

  const handleReset2FA = async (userId) => {
    try {
      // First, fetch CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch(`/api/users/${userId}/reset-2fa`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset 2FA');
      }
      
      enqueueSnackbar('2FA reset successfully', { variant: 'success' });
      fetchUsers();
    } catch (error) {
      console.error('Error resetting 2FA:', error);
      enqueueSnackbar('Failed to reset 2FA', { variant: 'error' });
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditMode(true);
      setSelectedUser(user);
      setFormData({
        username: user.username,
        password: '',
        confirmPassword: '',
        role: user.role,
        permissions: user.permissions || []
      });
    } else {
      setEditMode(false);
      setSelectedUser(null);
      setFormData({
        username: '',
        password: '',
        confirmPassword: '',
        role: 'operator',
        permissions: []
      });
    }
    setErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setSelectedUser(null);
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      role: 'operator',
      permissions: []
    });
    setErrors({});
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <AdminIcon color="error" />;
      case 'operator':
        return <OperatorIcon color="primary" />;
      case 'viewer':
        return <ViewerIcon color="action" />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'operator':
        return 'primary';
      case 'viewer':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getDefaultPermissions = (role) => {
    switch (role) {
      case 'admin':
        return ['read', 'write', 'delete', 'configure', 'manage_users'];
      case 'operator':
        return ['read', 'write'];
      case 'viewer':
        return ['read'];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          User Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add User
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>2FA</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getRoleIcon(user.role)}
                    <Typography>{user.username}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    color={getRoleColor(user.role)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {user.permissions.map((perm) => (
                      <Chip
                        key={perm}
                        label={perm}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  {user.twoFactorEnabled ? (
                    <Chip
                      label="Enabled"
                      color="success"
                      size="small"
                      icon={<SecurityIcon />}
                    />
                  ) : (
                    <Chip
                      label="Disabled"
                      variant="outlined"
                      size="small"
                    />
                  )}
                </TableCell>
                <TableCell>
                  {user.isLocked ? (
                    <Chip
                      label="Locked"
                      color="error"
                      size="small"
                      icon={<LockIcon />}
                    />
                  ) : (
                    <Chip
                      label="Active"
                      color="success"
                      size="small"
                    />
                  )}
                </TableCell>
                <TableCell>
                  {user.lastLogin
                    ? new Date(user.lastLogin).toLocaleString()
                    : 'Never'}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit User">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(user)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  {user.isLocked && (
                    <Tooltip title="Unlock Account">
                      <IconButton
                        size="small"
                        onClick={() => handleUnlock(user.id)}
                      >
                        <LockOpenIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {user.twoFactorEnabled && (
                    <Tooltip title="Reset 2FA">
                      <IconButton
                        size="small"
                        onClick={() => handleReset2FA(user.id)}
                      >
                        <KeyIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete User">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedUser(user);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            {!editMode && (
              <TextField
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                error={!!errors.username}
                helperText={errors.username}
                fullWidth
                required
              />
            )}
            
            <TextField
              label={editMode ? 'New Password (leave empty to keep current)' : 'Password'}
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={!!errors.password}
              helperText={errors.password}
              fullWidth
              required={!editMode}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            <TextField
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword}
              fullWidth
              required={!editMode || !!formData.password}
            />
            
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({
                  ...formData,
                  role: e.target.value,
                  permissions: getDefaultPermissions(e.target.value)
                })}
                label="Role"
              >
                <MenuItem value="admin">Admin (Full Access)</MenuItem>
                <MenuItem value="operator">Engineering (Read/Write)</MenuItem>
                <MenuItem value="viewer">Helpdesk (Read Only)</MenuItem>
              </Select>
              <FormHelperText>
                Admin: Full system control | Engineering: Can modify settings | Helpdesk: View only
              </FormHelperText>
            </FormControl>
            
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Permissions:
              </Typography>
              <Box display="flex" gap={0.5} flexWrap="wrap">
                {formData.permissions.map((perm) => (
                  <Chip
                    key={perm}
                    label={perm}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            Are you sure you want to delete user "{selectedUser?.username}"?
            This action cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;