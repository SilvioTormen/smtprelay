import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Refresh as RefreshIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  ErrorOutline as ErrorIcon,
  CheckCircle as SuccessIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { useWebSocket } from '../contexts/WebSocketContext';

const Queue = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { socket, connected } = useWebSocket();
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState('running');
  const [selectedRows, setSelectedRows] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    failed: 0,
    completed: 0,
  });

  const columns = [
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => {
        const getStatusIcon = () => {
          switch (params.value) {
            case 'pending':
              return <PendingIcon color="info" />;
            case 'processing':
              return <CircularProgress size={20} />;
            case 'completed':
              return <SuccessIcon color="success" />;
            case 'failed':
              return <ErrorIcon color="error" />;
            default:
              return null;
          }
        };
        
        return (
          <Tooltip title={params.value}>
            {getStatusIcon()}
          </Tooltip>
        );
      },
    },
    { field: 'messageId', headerName: 'Message ID', width: 150 },
    { field: 'from', headerName: 'From', flex: 1, minWidth: 200 },
    { field: 'to', headerName: 'To', flex: 1, minWidth: 200 },
    { field: 'subject', headerName: 'Subject', flex: 1, minWidth: 250 },
    { 
      field: 'size', 
      headerName: 'Size', 
      width: 100,
      valueFormatter: (params) => {
        const size = params.value;
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
      },
    },
    { 
      field: 'attempts', 
      headerName: 'Attempts', 
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={`${params.value}/3`} 
          size="small"
          color={params.value >= 3 ? 'error' : params.value > 1 ? 'warning' : 'default'}
        />
      ),
    },
    { field: 'queuedAt', headerName: 'Queued At', width: 180 },
    { field: 'nextRetry', headerName: 'Next Retry', width: 180 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Retry Now">
            <IconButton
              size="small"
              onClick={() => handleRetry(params.row.id)}
              color="primary"
              disabled={params.row.status === 'processing'}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDelete(params.row.id)}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  useEffect(() => {
    fetchQueueItems();
    
    if (socket && connected) {
      socket.on('queue:update', (data) => {
        setQueueItems(data.items);
        setStats(data.stats);
      });

      return () => {
        socket.off('queue:update');
      };
    }
  }, [socket, connected]);

  const fetchQueueItems = async () => {
    try {
      const response = await axios.get('/api/queue');
      setQueueItems(response.data.items);
      setStats(response.data.stats);
      setQueueStatus(response.data.status);
    } catch (error) {
      enqueueSnackbar('Failed to fetch queue items', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id) => {
    try {
      await axios.post(`/api/queue/${id}/retry`);
      enqueueSnackbar('Message queued for retry', { variant: 'success' });
      fetchQueueItems();
    } catch (error) {
      enqueueSnackbar('Failed to retry message', { variant: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this message from the queue?')) {
      try {
        await axios.delete(`/api/queue/${id}`);
        enqueueSnackbar('Message deleted from queue', { variant: 'success' });
        fetchQueueItems();
      } catch (error) {
        enqueueSnackbar('Failed to delete message', { variant: 'error' });
      }
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedRows.length === 0) {
      enqueueSnackbar('No items selected', { variant: 'warning' });
      return;
    }

    try {
      await axios.post('/api/queue/bulk', {
        action,
        ids: selectedRows,
      });
      enqueueSnackbar(`Bulk ${action} completed`, { variant: 'success' });
      setSelectedRows([]);
      fetchQueueItems();
    } catch (error) {
      enqueueSnackbar(`Failed to ${action} items`, { variant: 'error' });
    }
  };

  const toggleQueueStatus = async () => {
    try {
      const newStatus = queueStatus === 'running' ? 'paused' : 'running';
      await axios.post('/api/queue/control', { action: newStatus });
      setQueueStatus(newStatus);
      enqueueSnackbar(`Queue ${newStatus}`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to change queue status', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Email Queue
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={queueStatus === 'running' ? <PauseIcon /> : <PlayIcon />}
            onClick={toggleQueueStatus}
            sx={{ mr: 1 }}
          >
            {queueStatus === 'running' ? 'Pause Queue' : 'Resume Queue'}
          </Button>
          <IconButton onClick={fetchQueueItems}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Box display="flex" gap={2} mb={3}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="textSecondary">Pending</Typography>
          <Typography variant="h4" color="info.main">{stats.pending}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="textSecondary">Processing</Typography>
          <Typography variant="h4" color="warning.main">{stats.processing}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="textSecondary">Failed</Typography>
          <Typography variant="h4" color="error.main">{stats.failed}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="textSecondary">Completed (24h)</Typography>
          <Typography variant="h4" color="success.main">{stats.completed}</Typography>
        </Paper>
      </Box>

      {queueStatus === 'paused' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Queue processing is currently paused
        </Alert>
      )}

      {selectedRows.length > 0 && (
        <Box mb={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SendIcon />}
            onClick={() => handleBulkAction('retry')}
            sx={{ mr: 1 }}
          >
            Retry Selected ({selectedRows.length})
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleBulkAction('delete')}
          >
            Delete Selected ({selectedRows.length})
          </Button>
        </Box>
      )}

      <Paper elevation={3}>
        <DataGrid
          rows={queueItems}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          loading={loading}
          autoHeight
          checkboxSelection
          disableSelectionOnClick
          onSelectionModelChange={(newSelection) => {
            setSelectedRows(newSelection);
          }}
          selectionModel={selectedRows}
          sx={{
            '& .MuiDataGrid-row': {
              '&.Mui-selected': {
                backgroundColor: 'action.selected',
              },
            },
          }}
        />
      </Paper>
    </Box>
  );
};

export default Queue;