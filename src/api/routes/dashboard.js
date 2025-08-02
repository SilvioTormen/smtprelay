const express = require('express');
const router = express.Router();

// Stats collector (will be injected)
let statsCollector = null;

// Set stats collector
router.setStatsCollector = (collector) => {
  statsCollector = collector;
};

// Get dashboard overview stats
router.get('/stats', async (req, res) => {
  try {
    if (!statsCollector) {
      return res.status(503).json({ 
        error: 'Stats collector not initialized',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const stats = await statsCollector.getStats();
    
    res.json({
      success: true,
      data: {
        overview: {
          status: stats.status || 'operational',
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        },
        mail: {
          sent_today: stats.mailsSentToday || 0,
          sent_week: stats.mailsSentWeek || 0,
          sent_month: stats.mailsSentMonth || 0,
          success_rate: stats.successRate || 100,
          average_processing_time: stats.avgProcessingTime || 0
        },
        queue: {
          pending: stats.queuePending || 0,
          processing: stats.queueProcessing || 0,
          failed: stats.queueFailed || 0,
          retry_queue: stats.retryQueue || 0
        },
        connections: {
          active: stats.activeConnections || 0,
          peak_today: stats.peakConnections || 0,
          total_today: stats.totalConnections || 0
        },
        errors: {
          auth_failures: stats.authFailures || 0,
          relay_failures: stats.relayFailures || 0,
          error_rate: stats.errorRate || 0
        },
        performance: {
          cpu_usage: stats.cpuUsage || 0,
          memory_usage: stats.memoryUsage || 0,
          disk_usage: stats.diskUsage || 0
        }
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      code: 'STATS_ERROR'
    });
  }
});

// Get time series data for charts
router.get('/stats/timeseries', async (req, res) => {
  try {
    const { period = '24h', metric = 'mails_sent' } = req.query;
    
    if (!statsCollector) {
      return res.status(503).json({ 
        error: 'Stats collector not initialized',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const data = await statsCollector.getTimeSeries(period, metric);
    
    res.json({
      success: true,
      data: {
        period,
        metric,
        points: data || []
      }
    });
  } catch (error) {
    console.error('Timeseries error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch time series data',
      code: 'TIMESERIES_ERROR'
    });
  }
});

// Get top statistics
router.get('/stats/top', async (req, res) => {
  try {
    const { category = 'devices', limit = 10 } = req.query;
    
    if (!statsCollector) {
      return res.status(503).json({ 
        error: 'Stats collector not initialized',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    let data;
    switch (category) {
      case 'devices':
        data = await statsCollector.getTopDevices(limit);
        break;
      case 'recipients':
        data = await statsCollector.getTopRecipients(limit);
        break;
      case 'errors':
        data = await statsCollector.getTopErrors(limit);
        break;
      default:
        return res.status(400).json({ 
          error: 'Invalid category',
          code: 'INVALID_CATEGORY'
        });
    }
    
    res.json({
      success: true,
      data: {
        category,
        items: data || []
      }
    });
  } catch (error) {
    console.error('Top stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch top statistics',
      code: 'TOP_STATS_ERROR'
    });
  }
});

// Get recent activity log
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    if (!statsCollector) {
      return res.status(503).json({ 
        error: 'Stats collector not initialized',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const activities = await statsCollector.getRecentActivity(limit, offset);
    
    res.json({
      success: true,
      data: {
        activities: activities || [],
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: activities?.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch activity log',
      code: 'ACTIVITY_ERROR'
    });
  }
});

// Get system health
router.get('/health', async (req, res) => {
  try {
    const health = {
      smtp_server: 'healthy',
      exchange_connection: 'healthy',
      redis_connection: 'healthy',
      disk_space: 'healthy',
      memory: 'healthy',
      cpu: 'healthy'
    };

    // Check actual health (simplified)
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memPercent > 90) health.memory = 'critical';
    else if (memPercent > 75) health.memory = 'warning';

    const allHealthy = Object.values(health).every(h => h === 'healthy');
    
    res.json({
      success: true,
      data: {
        overall: allHealthy ? 'healthy' : 'degraded',
        services: health,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      error: 'Failed to check system health',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

// Get alerts and notifications
router.get('/alerts', async (req, res) => {
  try {
    const { unread = false } = req.query;
    
    if (!statsCollector) {
      return res.status(503).json({ 
        error: 'Stats collector not initialized',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const alerts = await statsCollector.getAlerts(unread === 'true');
    
    res.json({
      success: true,
      data: {
        alerts: alerts || [],
        unread_count: alerts?.filter(a => !a.read).length || 0
      }
    });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch alerts',
      code: 'ALERTS_ERROR'
    });
  }
});

// Mark alert as read
router.put('/alerts/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!statsCollector) {
      return res.status(503).json({ 
        error: 'Stats collector not initialized',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    await statsCollector.markAlertRead(id);
    
    res.json({
      success: true,
      message: 'Alert marked as read'
    });
  } catch (error) {
    console.error('Alert update error:', error);
    res.status(500).json({ 
      error: 'Failed to update alert',
      code: 'ALERT_UPDATE_ERROR'
    });
  }
});

// Export data
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', period = '24h' } = req.query;
    
    if (!statsCollector) {
      return res.status(503).json({ 
        error: 'Stats collector not initialized',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const data = await statsCollector.exportData(period);
    
    switch (format) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="smtp-relay-export-${Date.now()}.csv"`);
        res.send(convertToCSV(data));
        break;
      case 'json':
      default:
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="smtp-relay-export-${Date.now()}.json"`);
        res.json(data);
        break;
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Failed to export data',
      code: 'EXPORT_ERROR'
    });
  }
});

// Helper function to convert to CSV
function convertToCSV(data) {
  if (!data || !data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
  ].join('\n');
  
  return csv;
}

module.exports = router;