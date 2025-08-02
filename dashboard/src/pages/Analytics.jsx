import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import EmailFlowSankey from '../components/EmailFlowSankey';
import GeoHeatMap from '../components/GeoHeatMap';
import TimeSeriesAnalytics from '../components/TimeSeriesAnalytics';
import DeviceHealthMonitor from '../components/DeviceHealthMonitor';
import {
  BarChart3,
  Globe,
  Activity,
  Monitor,
  Download,
  RefreshCw,
  Bell,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

const Analytics = () => {
  const { apiRequest } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    emailFlow: null,
    geoDistribution: null,
    timeSeries: null,
    deviceHealth: null,
    alerts: []
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Load all analytics data
  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [flowRes, geoRes, timeRes, deviceRes, alertsRes] = await Promise.all([
        apiRequest('/api/analytics/email-flow'),
        apiRequest('/api/analytics/geo-distribution'),
        apiRequest('/api/analytics/time-series'),
        apiRequest('/api/analytics/device-health'),
        apiRequest('/api/analytics/alerts')
      ]);

      const [flowData, geoData, timeData, deviceData, alertsData] = await Promise.all([
        flowRes.json(),
        geoRes.json(),
        timeRes.json(),
        deviceRes.json(),
        alertsRes.json()
      ]);

      setData({
        emailFlow: flowData.data,
        geoDistribution: geoData.data,
        timeSeries: timeData.data,
        deviceHealth: deviceData.devices,
        alerts: alertsData.alerts
      });

      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      setLoading(false);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    loadAnalyticsData();

    if (autoRefresh) {
      const interval = setInterval(loadAnalyticsData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Export analytics data
  const handleExport = async (format = 'json') => {
    try {
      const response = await apiRequest('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          dataTypes: ['all'],
          range: '24h'
        })
      });

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'flow', label: 'Email Flow', icon: Activity },
    { id: 'geo', label: 'Geographic', icon: Globe },
    { id: 'timeseries', label: 'Time Series', icon: TrendingUp },
    { id: 'devices', label: 'Device Health', icon: Monitor }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600">
              Real-time insights and monitoring for your SMTP relay infrastructure
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="sr-only"
                />
                <div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                  autoRefresh ? 'bg-blue-600' : 'bg-gray-200'
                }`}>
                  <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
                <span className="ml-2 text-sm text-gray-700">Auto Refresh</span>
              </label>
              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="text-sm border-gray-300 rounded-md"
                >
                  <option value="10000">10s</option>
                  <option value="30000">30s</option>
                  <option value="60000">1m</option>
                  <option value="300000">5m</option>
                </select>
              )}
            </div>

            {/* Manual Refresh */}
            <button
              onClick={loadAnalyticsData}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="h-5 w-5" />
            </button>

            {/* Export Button */}
            <div className="relative group">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Export as CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Last Update */}
        <div className="mt-4 text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* Alerts Banner */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">Active Alerts</h3>
              <div className="mt-2 space-y-1">
                {data.alerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="text-sm text-yellow-700">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      alert.severity === 'critical' ? 'bg-red-500' :
                      alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></span>
                    {alert.message}
                  </div>
                ))}
              </div>
            </div>
            <button className="text-yellow-600 hover:text-yellow-800">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2">
                <EmailFlowSankey data={data.emailFlow} />
              </div>
              <TimeSeriesAnalytics data={data.timeSeries} />
              <DeviceHealthMonitor 
                devices={data.deviceHealth}
                onDeviceSelect={(device) => console.log('Selected device:', device)}
              />
            </div>
          )}

          {/* Email Flow Tab */}
          {activeTab === 'flow' && (
            <EmailFlowSankey data={data.emailFlow} width={1400} height={700} />
          )}

          {/* Geographic Tab */}
          {activeTab === 'geo' && (
            <GeoHeatMap data={data.geoDistribution} height="600px" />
          )}

          {/* Time Series Tab */}
          {activeTab === 'timeseries' && (
            <TimeSeriesAnalytics data={data.timeSeries} timeRange="24h" />
          )}

          {/* Device Health Tab */}
          {activeTab === 'devices' && (
            <DeviceHealthMonitor 
              devices={data.deviceHealth}
              onDeviceSelect={(device) => console.log('Selected device:', device)}
              autoRefresh={autoRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;