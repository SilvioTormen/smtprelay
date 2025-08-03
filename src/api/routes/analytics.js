const express = require('express');
const router = express.Router();
// Use production auth middleware
const { authenticate, authorize } = require('../middleware/auth');
// Comment out dependencies we don't have yet
// const geoip = require('geoip-lite');
// const { subHours, subDays, format } = require('date-fns');

// Helper functions to replace date-fns
const subHours = (date, hours) => {
  const result = new Date(date);
  result.setHours(result.getHours() - hours);
  return result;
};

// Mock data generator for demo (replace with real data from database)
const generateMockData = {
  // Generate email flow data for Sankey diagram
  emailFlow: () => {
    const devices = [
      { id: 'printer1', name: 'HP Printer - Floor 1', type: 'device' },
      { id: 'printer2', name: 'Canon Scanner - HR', type: 'device' },
      { id: 'nas1', name: 'Synology NAS', type: 'device' },
      { id: 'camera1', name: 'Security Cam - Main', type: 'device' },
      { id: 'app1', name: 'Legacy CRM', type: 'device' }
    ];
    
    const relay = { id: 'relay', name: 'SMTP Relay', type: 'relay' };
    const exchange = { id: 'exchange', name: 'Exchange Online', type: 'exchange' };
    
    const destinations = [
      { id: 'internal', name: 'Internal Recipients', type: 'destination' },
      { id: 'external', name: 'External Recipients', type: 'destination' },
      { id: 'archived', name: 'Archived', type: 'destination' },
      { id: 'quarantine', name: 'Quarantine', type: 'destination' }
    ];
    
    const nodes = [...devices, relay, exchange, ...destinations];
    
    const links = [
      // Devices to Relay
      ...devices.map(device => ({
        source: device.id,
        target: 'relay',
        value: Math.floor(Math.random() * 1000) + 100
      })),
      // Relay to Exchange
      {
        source: 'relay',
        target: 'exchange',
        value: devices.reduce((sum, d) => {
          const link = { value: Math.floor(Math.random() * 1000) + 100 };
          return sum + link.value;
        }, 0) * 0.95 // 95% success rate
      },
      // Exchange to Destinations
      { source: 'exchange', target: 'internal', value: 2500 },
      { source: 'exchange', target: 'external', value: 1500 },
      { source: 'exchange', target: 'archived', value: 300 },
      { source: 'exchange', target: 'quarantine', value: 50 }
    ];
    
    // Calculate node values
    nodes.forEach(node => {
      const incoming = links.filter(l => l.target === node.id).reduce((sum, l) => sum + l.value, 0);
      const outgoing = links.filter(l => l.source === node.id).reduce((sum, l) => sum + l.value, 0);
      node.value = Math.max(incoming, outgoing) || 100;
    });
    
    return { nodes, links };
  },

  // Generate geographic distribution data
  geoDistribution: () => {
    // For testing, always return external network data to see the world map
    const isInternalNetwork = false; // Math.random() > 0.5;
    
    if (isInternalNetwork) {
      // Generate internal network data with subnets
      const subnets = [
        { subnet: '192.168.1.0/24', name: 'Office Floor 1', vlan: 'VLAN 10' },
        { subnet: '192.168.2.0/24', name: 'Office Floor 2', vlan: 'VLAN 20' },
        { subnet: '192.168.3.0/24', name: 'Server Room', vlan: 'VLAN 30' },
        { subnet: '10.0.1.0/24', name: 'Warehouse', vlan: 'VLAN 40' },
        { subnet: '10.0.2.0/24', name: 'Guest Network', vlan: 'VLAN 50' },
        { subnet: '172.16.1.0/24', name: 'Management', vlan: 'VLAN 100' },
        { subnet: '192.168.10.0/24', name: 'IoT Devices', vlan: 'VLAN 60' },
        { subnet: '192.168.20.0/24', name: 'Printers', vlan: 'VLAN 70' }
      ];
      
      const deviceTypes = ['printer', 'scanner', 'nas', 'camera', 'computer', 'iot'];
      
      return subnets.map(subnet => ({
        country: subnet.name, // Using country field for subnet name
        subnet: subnet.subnet,
        vlan: subnet.vlan,
        ip: subnet.subnet.replace('/24', `.${Math.floor(Math.random() * 250) + 1}`),
        type: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
        count: Math.floor(Math.random() * 500) + 50,
        successRate: Math.floor(Math.random() * 5) + 95,
        avgSize: `${Math.floor(Math.random() * 500) + 50}KB`,
        avgDeliveryTime: `${Math.floor(Math.random() * 50) + 10}ms`,
        deviceCount: Math.floor(Math.random() * 20) + 1
      })).sort((a, b) => b.count - a.count);
    } else {
      // Generate external network data with countries
      const cities = [
        { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060 },
        { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
        { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
        { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
        { city: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050 },
        { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
        { city: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
        { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
        { city: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
        { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777 }
      ];
      
      return cities.map(city => ({
        ...city,
        ip: `${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
        count: Math.floor(Math.random() * 500) + 50,
        successRate: Math.floor(Math.random() * 5) + 95,
        avgSize: `${Math.floor(Math.random() * 500) + 50}KB`,
        avgDeliveryTime: `${Math.floor(Math.random() * 5) + 1}s`,
        topRecipients: [
          `user${Math.floor(Math.random() * 100)}@example.com`,
          `admin${Math.floor(Math.random() * 10)}@company.com`,
          `support@${city.city.toLowerCase()}.local`
        ]
      })).sort((a, b) => b.count - a.count);
    }
  },

  // Generate time series data with anomalies
  timeSeries: (hours = 24) => {
    const now = new Date();
    const data = {
      emailVolume: [],
      deliveryRate: [],
      errorRate: [],
      avgProcessingTime: [],
      queueDepth: []
    };
    
    for (let i = hours - 1; i >= 0; i--) {
      const timestamp = subHours(now, i).toISOString();
      const hour = new Date(timestamp).getHours();
      
      // Simulate realistic patterns
      const isBusinessHours = hour >= 8 && hour <= 18;
      const baseVolume = isBusinessHours ? 200 : 50;
      
      // Add some anomalies
      const isAnomaly = Math.random() < 0.1; // 10% chance of anomaly
      const anomalyMultiplier = isAnomaly ? (Math.random() < 0.5 ? 3 : 0.2) : 1;
      
      data.emailVolume.push({
        timestamp,
        value: Math.floor((baseVolume + Math.random() * 100) * anomalyMultiplier)
      });
      
      data.deliveryRate.push({
        timestamp,
        value: isAnomaly ? Math.floor(Math.random() * 30) + 60 : Math.floor(Math.random() * 5) + 95
      });
      
      data.errorRate.push({
        timestamp,
        value: isAnomaly ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 3)
      });
      
      data.avgProcessingTime.push({
        timestamp,
        value: Math.floor((Math.random() * 500 + 100) * (isAnomaly ? 5 : 1))
      });
      
      data.queueDepth.push({
        timestamp,
        value: Math.floor((Math.random() * 50 + 10) * (isAnomaly ? 10 : 1))
      });
    }
    
    return data;
  },

  // Generate device health data
  deviceHealth: () => {
    const deviceTypes = ['Printer', 'Scanner', 'NAS', 'Camera', 'Application'];
    const statuses = ['online', 'online', 'online', 'offline', 'warning', 'error'];
    
    return Array.from({ length: 15 }, (_, i) => {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const isOnline = status === 'online';
      
      return {
        id: `device-${i + 1}`,
        name: `${deviceTypes[i % deviceTypes.length]} ${Math.floor(i / deviceTypes.length) + 1}`,
        type: deviceTypes[i % deviceTypes.length].toLowerCase(),
        status,
        ip: `192.168.${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 250) + 1}`,
        port: [25, 587, 465][Math.floor(Math.random() * 3)],
        lastSeen: isOnline ? new Date().toISOString() : 
                  subHours(new Date(), Math.floor(Math.random() * 72)).toISOString(),
        emailsSent: Math.floor(Math.random() * 10000),
        responseTime: isOnline ? Math.floor(Math.random() * 100) + 10 : null,
        isActive: isOnline && Math.random() > 0.3,
        trend: Math.random() > 0.5 ? 'up' : 'down',
        lastError: status === 'error' ? 'Connection timeout' : 
                   status === 'warning' ? 'High latency detected' : null,
        metrics: isOnline ? {
          cpu: Math.floor(Math.random() * 100),
          memory: Math.floor(Math.random() * 100),
          queueDepth: Math.floor(Math.random() * 200),
          successRate: Math.floor(Math.random() * 10) + 90
        } : null
      };
    });
  }
};

/**
 * Get email flow data for Sankey diagram
 */
router.get('/email-flow', authenticate, async (req, res) => {
  try {
    // In production, aggregate data from your database
    const flowData = generateMockData.emailFlow();
    
    res.json({
      success: true,
      data: flowData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Email flow data error:', error);
    res.status(500).json({
      error: 'Failed to retrieve email flow data',
      code: 'FLOW_DATA_ERROR'
    });
  }
});

/**
 * Get geographic distribution of emails
 */
router.get('/geo-distribution', authenticate, async (req, res) => {
  try {
    // In production, use real IP addresses from email logs and geoip lookup
    const geoData = generateMockData.geoDistribution();
    
    res.json({
      success: true,
      data: geoData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Geo distribution error:', error);
    res.status(500).json({
      error: 'Failed to retrieve geographic data',
      code: 'GEO_DATA_ERROR'
    });
  }
});

/**
 * Get time series metrics with anomaly markers
 */
router.get('/time-series', authenticate, async (req, res) => {
  try {
    const { range = '24h', metric } = req.query;
    
    // Parse time range
    let hours = 24;
    if (range === '7d') hours = 168;
    else if (range === '30d') hours = 720;
    else if (range === '1h') hours = 1;
    
    const timeSeriesData = generateMockData.timeSeries(hours);
    
    res.json({
      success: true,
      data: metric ? { [metric]: timeSeriesData[metric] } : timeSeriesData,
      range,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Time series error:', error);
    res.status(500).json({
      error: 'Failed to retrieve time series data',
      code: 'TIME_SERIES_ERROR'
    });
  }
});

/**
 * Get device health monitoring data
 */
router.get('/device-health', authenticate, async (req, res) => {
  try {
    const devices = generateMockData.deviceHealth();
    
    // Calculate summary statistics
    const summary = {
      total: devices.length,
      online: devices.filter(d => d.status === 'online').length,
      offline: devices.filter(d => d.status === 'offline').length,
      warning: devices.filter(d => d.status === 'warning').length,
      error: devices.filter(d => d.status === 'error').length,
      totalEmails: devices.reduce((sum, d) => sum + d.emailsSent, 0),
      avgResponseTime: Math.round(
        devices.filter(d => d.responseTime).reduce((sum, d) => sum + d.responseTime, 0) /
        devices.filter(d => d.responseTime).length
      )
    };
    
    res.json({
      success: true,
      devices,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Device health error:', error);
    res.status(500).json({
      error: 'Failed to retrieve device health data',
      code: 'DEVICE_HEALTH_ERROR'
    });
  }
});

/**
 * Get real-time alerts and anomalies
 */
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const alerts = [
      {
        id: 1,
        severity: 'critical',
        type: 'device_offline',
        message: 'Printer HP-Floor1 is offline for more than 1 hour',
        device: 'HP-Floor1',
        timestamp: subHours(new Date(), 1).toISOString()
      },
      {
        id: 2,
        severity: 'warning',
        type: 'high_error_rate',
        message: 'Error rate above threshold (15% > 5%)',
        metric: 'errorRate',
        value: 15,
        threshold: 5,
        timestamp: subHours(new Date(), 0.5).toISOString()
      },
      {
        id: 3,
        severity: 'info',
        type: 'anomaly_detected',
        message: 'Unusual email volume detected from Scanner-HR',
        device: 'Scanner-HR',
        timestamp: new Date().toISOString()
      }
    ];
    
    res.json({
      success: true,
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      code: 'ALERTS_ERROR'
    });
  }
});

/**
 * Get performance metrics for specific device
 */
router.get('/device/:deviceId/metrics', authenticate, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { range = '1h' } = req.query;
    
    // Generate mock metrics for the device
    const metrics = {
      deviceId,
      current: {
        status: 'online',
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        queueDepth: Math.floor(Math.random() * 50),
        successRate: Math.floor(Math.random() * 10) + 90,
        responseTime: Math.floor(Math.random() * 100) + 10
      },
      history: Array.from({ length: 60 }, (_, i) => ({
        timestamp: subHours(new Date(), i / 60).toISOString(),
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        queueDepth: Math.floor(Math.random() * 50),
        emailsSent: Math.floor(Math.random() * 10)
      }))
    };
    
    res.json({
      success: true,
      metrics,
      range,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Device metrics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve device metrics',
      code: 'DEVICE_METRICS_ERROR'
    });
  }
});

/**
 * Export analytics data
 */
router.post('/export', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { format = 'json', dataTypes = ['all'], range = '24h' } = req.body;
    
    // Collect requested data
    const exportData = {};
    
    if (dataTypes.includes('all') || dataTypes.includes('emailFlow')) {
      exportData.emailFlow = generateMockData.emailFlow();
    }
    
    if (dataTypes.includes('all') || dataTypes.includes('geoDistribution')) {
      exportData.geoDistribution = generateMockData.geoDistribution();
    }
    
    if (dataTypes.includes('all') || dataTypes.includes('timeSeries')) {
      exportData.timeSeries = generateMockData.timeSeries();
    }
    
    if (dataTypes.includes('all') || dataTypes.includes('deviceHealth')) {
      exportData.deviceHealth = generateMockData.deviceHealth();
    }
    
    // Format response based on requested format
    if (format === 'csv') {
      // Convert to CSV (simplified example)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
      res.send('data,value\n' + Object.entries(exportData).map(([k, v]) => `${k},${JSON.stringify(v)}`).join('\n'));
    } else {
      res.json({
        success: true,
        data: exportData,
        range,
        exportedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Failed to export analytics data',
      code: 'EXPORT_ERROR'
    });
  }
});

module.exports = router;