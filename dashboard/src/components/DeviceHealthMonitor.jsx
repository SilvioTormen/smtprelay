import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Server,
  Mail,
  Zap,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const DeviceHealthMonitor = ({ devices, onDeviceSelect, autoRefresh = true }) => {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('status');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLastUpdate(new Date());
      }, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Calculate overall health statistics
  const healthStats = {
    total: devices?.length || 0,
    online: devices?.filter(d => d.status === 'online').length || 0,
    offline: devices?.filter(d => d.status === 'offline').length || 0,
    warning: devices?.filter(d => d.status === 'warning').length || 0,
    error: devices?.filter(d => d.status === 'error').length || 0
  };

  const healthScore = healthStats.total > 0 
    ? Math.round((healthStats.online / healthStats.total) * 100)
    : 0;

  // Filter and sort devices
  const filteredDevices = devices?.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.ip.includes(searchTerm);
    const matchesFilter = filterStatus === 'all' || device.status === filterStatus;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'status':
        const statusOrder = { error: 0, warning: 1, offline: 2, online: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      case 'name':
        return a.name.localeCompare(b.name);
      case 'lastSeen':
        return new Date(b.lastSeen) - new Date(a.lastSeen);
      case 'emailsSent':
        return b.emailsSent - a.emailsSent;
      default:
        return 0;
    }
  }) || [];

  // Pie chart data
  const pieData = [
    { name: 'Online', value: healthStats.online, color: '#10B981' },
    { name: 'Offline', value: healthStats.offline, color: '#6B7280' },
    { name: 'Warning', value: healthStats.warning, color: '#F59E0B' },
    { name: 'Error', value: healthStats.error, color: '#EF4444' }
  ].filter(d => d.value > 0);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800 border-green-200';
      case 'offline': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Device Health Monitor</h3>
            <p className="text-sm text-gray-600">
              Real-time status of all connected SMTP devices
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Last update: {formatLastSeen(lastUpdate)}</span>
            <button
              onClick={() => setLastUpdate(new Date())}
              className="ml-2 p-1 hover:bg-gray-100 rounded"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Health Score and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overall Health Score */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{healthScore}%</div>
                <div className="text-sm opacity-90">Overall Health Score</div>
              </div>
              <div className="relative">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${healthScore * 1.76} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <Server className="absolute inset-0 m-auto h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Device Status Distribution */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>{healthStats.online} Online</span>
              </div>
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span>{healthStats.offline} Offline</span>
              </div>
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>{healthStats.warning} Warning</span>
              </div>
              <div className="flex items-center space-x-1 text-xs">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>{healthStats.error} Error</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-700">Total Emails</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {devices?.reduce((sum, d) => sum + (d.emailsSent || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700">Avg Response</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {devices?.reduce((sum, d) => sum + (d.responseTime || 0), 0) / (devices?.length || 1)}ms
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-gray-700">Active Now</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {devices?.filter(d => d.isActive).length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search devices by name or IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex space-x-2">
          {['all', 'online', 'offline', 'warning', 'error'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'all' && ` (${healthStats.total})`}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="status">Sort by Status</option>
          <option value="name">Sort by Name</option>
          <option value="lastSeen">Sort by Last Seen</option>
          <option value="emailsSent">Sort by Emails Sent</option>
        </select>
      </div>

      {/* Device List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredDevices.map(device => (
          <div
            key={device.id}
            onClick={() => {
              setSelectedDevice(device);
              onDeviceSelect?.(device);
            }}
            className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
              selectedDevice?.id === device.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getStatusIcon(device.status)}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{device.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(device.status)}`}>
                      {device.status}
                    </span>
                    {device.isActive && (
                      <span className="flex items-center space-x-1 text-xs text-green-600">
                        <Wifi className="h-3 w-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <span>IP: {device.ip}</span>
                    <span>Port: {device.port}</span>
                    <span>Type: {device.type}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  Last seen: {formatLastSeen(device.lastSeen)}
                </div>
                <div className="flex items-center justify-end space-x-4 mt-1">
                  <div className="flex items-center space-x-1 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>{device.emailsSent?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm">
                    <Zap className="h-4 w-4 text-gray-400" />
                    <span>{device.responseTime || 0}ms</span>
                  </div>
                  {device.trend && (
                    <div className="flex items-center space-x-1 text-sm">
                      {device.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {device.lastError && (
              <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                {device.lastError}
              </div>
            )}

            {/* Health Indicators */}
            {device.status === 'online' && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                <div className="text-center p-1 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">CPU</div>
                  <div className={`text-sm font-semibold ${
                    device.metrics?.cpu > 80 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {device.metrics?.cpu || 0}%
                  </div>
                </div>
                <div className="text-center p-1 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Memory</div>
                  <div className={`text-sm font-semibold ${
                    device.metrics?.memory > 80 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {device.metrics?.memory || 0}%
                  </div>
                </div>
                <div className="text-center p-1 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Queue</div>
                  <div className={`text-sm font-semibold ${
                    device.metrics?.queueDepth > 100 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {device.metrics?.queueDepth || 0}
                  </div>
                </div>
                <div className="text-center p-1 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Success</div>
                  <div className={`text-sm font-semibold ${
                    device.metrics?.successRate < 95 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {device.metrics?.successRate || 100}%
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No devices message */}
      {filteredDevices.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Monitor className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No devices found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

export default DeviceHealthMonitor;