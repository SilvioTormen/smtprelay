import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

const Devices = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    type: 'printer',
    auth: 'none',
    username: '',
    password: '',
  });

  const columns = [
    { field: 'name', headerName: 'Device Name', flex: 1, minWidth: 150 },
    { field: 'ip', headerName: 'IP Address', width: 150 },
    { 
      field: 'type', 
      headerName: 'Type', 
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => {
        const getStatusIcon = () => {
          switch (params.value) {
            case 'active':
              return <CheckCircleIcon color="success" fontSize="small" />;
            case 'inactive':
              return <CancelIcon color="error" fontSize="small" />;
            default:
              return <WarningIcon color="warning" fontSize="small" />;
          }
        };
        
        return (
          <Box display="flex" alignItems="center">
            {getStatusIcon()}
            <Typography sx={{ ml: 1 }} variant="body2">
              {params.value}
            </Typography>
          </Box>
        );
      },
    },
    { field: 'lastSeen', headerName: 'Last Seen', width: 180 },
    { field: 'emailsSent', headerName: 'Emails Sent', width: 120, type: 'number' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleEdit(params.row)}
            color="primary"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/api/devices');
      setDevices(response.data);
    } catch (error) {
      enqueueSnackbar('Failed to fetch devices', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      ip: '',
      type: 'printer',
      auth: 'none',
      username: '',
      password: '',
    });
    setOpenDialog(true);
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      ip: device.ip,
      type: device.type,
      auth: device.auth || 'none',
      username: device.username || '',
      password: '',
    });
    setOpenDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        await axios.delete(`/api/devices/${id}`);
        enqueueSnackbar('Device deleted successfully', { variant: 'success' });
        fetchDevices();
      } catch (error) {
        enqueueSnackbar('Failed to delete device', { variant: 'error' });
      }
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingDevice) {
        await axios.put(`/api/devices/${editingDevice.id}`, formData);
        enqueueSnackbar('Device updated successfully', { variant: 'success' });
      } else {
        await axios.post('/api/devices', formData);
        enqueueSnackbar('Device added successfully', { variant: 'success' });
      }
      setOpenDialog(false);
      fetchDevices();
    } catch (error) {
      enqueueSnackbar('Failed to save device', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Device Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          Add Device
        </Button>
      </Box>

      <Paper elevation={3}>
        <DataGrid
          rows={devices}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          loading={loading}
          autoHeight
          disableSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell:hover': {
              cursor: 'pointer',
            },
          }}
        />
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDevice ? 'Edit Device' : 'Add New Device'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Device Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="IP Address"
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              margin="normal"
              required
              helperText="Enter IP address or CIDR range (e.g., 192.168.1.0/24)"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Device Type</InputLabel>
              <Select
                value={formData.type}
                label="Device Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <MenuItem value="printer">Printer</MenuItem>
                <MenuItem value="scanner">Scanner</MenuItem>
                <MenuItem value="nas">NAS System</MenuItem>
                <MenuItem value="monitoring">Monitoring Tool</MenuItem>
                <MenuItem value="camera">Security Camera</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Authentication</InputLabel>
              <Select
                value={formData.auth}
                label="Authentication"
                onChange={(e) => setFormData({ ...formData, auth: e.target.value })}
              >
                <MenuItem value="none">None (IP Whitelist)</MenuItem>
                <MenuItem value="basic">Basic Auth</MenuItem>
                <MenuItem value="static">Static User</MenuItem>
              </Select>
            </FormControl>
            {formData.auth !== 'none' && (
              <>
                <TextField
                  fullWidth
                  label="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  margin="normal"
                  helperText={editingDevice ? "Leave blank to keep existing password" : ""}
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingDevice ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Devices;