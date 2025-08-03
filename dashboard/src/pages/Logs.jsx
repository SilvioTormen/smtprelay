import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { useWebSocket } from '../contexts/WebSocketContext';

const Logs = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { socket, connected } = useWebSocket();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    level: 'all',
    search: '',
    timeRange: '1h',
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const logLevelColors = {
    error: 'error',
    warn: 'warning',
    info: 'info',
    debug: 'default',
  };

  useEffect(() => {
    fetchLogs();
    
    if (socket && connected && autoRefresh) {
      socket.on('logs:new', (log) => {
        setLogs(prev => [log, ...prev].slice(0, 1000)); // Keep last 1000 logs
      });

      return () => {
        socket.off('logs:new');
      };
    }
  }, [socket, connected, autoRefresh, filter]);

  const fetchLogs = async () => {
    try {
      const response = await axios.get('/api/logs', { params: filter });
      setLogs(response.data);
    } catch (error) {
      enqueueSnackbar('Failed to fetch logs', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message} ${log.details || ''}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smtp-relay-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === searchTerm.toLowerCase() ? 
        <mark key={index} style={{ backgroundColor: 'yellow' }}>{part}</mark> : 
        part
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          System Logs
        </Typography>
        <Box>
          <IconButton onClick={fetchLogs} title="Refresh">
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={handleDownload} title="Download Logs">
            <DownloadIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Filters */}
      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Log Level</InputLabel>
            <Select
              value={filter.level}
              label="Log Level"
              onChange={(e) => setFilter({ ...filter, level: e.target.value })}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="error">Error</MenuItem>
              <MenuItem value="warn">Warning</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="debug">Debug</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={filter.timeRange}
              label="Time Range"
              onChange={(e) => setFilter({ ...filter, timeRange: e.target.value })}
            >
              <MenuItem value="15m">Last 15 min</MenuItem>
              <MenuItem value="1h">Last 1 hour</MenuItem>
              <MenuItem value="6h">Last 6 hours</MenuItem>
              <MenuItem value="24h">Last 24 hours</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="Search logs..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              endAdornment: filter.search && (
                <IconButton
                  size="small"
                  onClick={() => setFilter({ ...filter, search: '' })}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              ),
            }}
            sx={{ flex: 1 }}
          />

          <FormControl size="small">
            <Select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.value)}
            >
              <MenuItem value={true}>Auto-refresh ON</MenuItem>
              <MenuItem value={false}>Auto-refresh OFF</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Logs Display */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 2, 
          maxHeight: 'calc(100vh - 300px)', 
          overflow: 'auto',
          backgroundColor: '#1e1e1e',
        }}
      >
        {loading ? (
          <Typography color="text.secondary" align="center">Loading logs...</Typography>
        ) : logs.length === 0 ? (
          <Alert severity="info">No logs found for the selected filters</Alert>
        ) : (
          <Box sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
            {logs.map((log, index) => (
              <Box
                key={index}
                sx={{
                  mb: 0.5,
                  p: 1,
                  backgroundColor: index % 2 === 0 ? '#252525' : '#1e1e1e',
                  borderLeft: `3px solid`,
                  borderColor: 
                    log.level === 'error' ? 'error.main' :
                    log.level === 'warn' ? 'warning.main' :
                    log.level === 'info' ? 'info.main' :
                    'grey.600',
                  '&:hover': {
                    backgroundColor: '#333',
                  },
                }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'grey.500',
                      minWidth: '150px',
                    }}
                  >
                    {formatTimestamp(log.timestamp)}
                  </Typography>
                  <Chip
                    label={log.level.toUpperCase()}
                    size="small"
                    color={logLevelColors[log.level]}
                    sx={{ minWidth: '60px' }}
                  />
                  <Typography 
                    sx={{ 
                      color: 'grey.100',
                      wordBreak: 'break-all',
                    }}
                  >
                    {highlightSearchTerm(log.message, filter.search)}
                  </Typography>
                </Box>
                {log.details && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'grey.400',
                      ml: '230px',
                      mt: 0.5,
                      fontFamily: 'monospace',
                    }}
                  >
                    {highlightSearchTerm(log.details, filter.search)}
                  </Typography>
                )}
                {log.metadata && (
                  <Box sx={{ ml: '230px', mt: 0.5 }}>
                    {Object.entries(log.metadata).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Logs;