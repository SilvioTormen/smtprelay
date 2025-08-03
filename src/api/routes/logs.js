const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Mock log generator
const generateMockLogs = (count = 100) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  const messages = [
    'SMTP connection established',
    'Authentication successful',
    'Email queued for delivery',
    'Failed to connect to Exchange Online',
    'Rate limit exceeded',
    'Device authenticated',
    'Token refreshed successfully',
    'Queue processing started',
    'Dashboard accessed',
    'Configuration updated'
  ];
  
  const logs = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - Math.random() * 3600000).toISOString();
    const level = levels[Math.floor(Math.random() * levels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    logs.push({
      timestamp,
      level,
      message,
      details: Math.random() > 0.5 ? `Additional details for ${message.toLowerCase()}` : null,
      metadata: Math.random() > 0.7 ? {
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        device: `device-${Math.floor(Math.random() * 10)}`
      } : null
    });
  }
  
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

// Get logs with filtering
router.get('/', async (req, res) => {
  const { level, search, timeRange } = req.query;
  
  // Generate mock logs
  let logs = generateMockLogs(200);
  
  // Apply filters
  if (level && level !== 'all') {
    logs = logs.filter(log => log.level === level);
  }
  
  if (search) {
    logs = logs.filter(log => 
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(search.toLowerCase()))
    );
  }
  
  if (timeRange) {
    const now = Date.now();
    let cutoff = 0;
    
    switch (timeRange) {
      case '15m':
        cutoff = now - 15 * 60 * 1000;
        break;
      case '1h':
        cutoff = now - 60 * 60 * 1000;
        break;
      case '6h':
        cutoff = now - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        cutoff = now - 60 * 60 * 1000;
    }
    
    logs = logs.filter(log => new Date(log.timestamp).getTime() > cutoff);
  }
  
  res.json(logs.slice(0, 1000)); // Limit to 1000 logs
});

// Get log file list
router.get('/files', async (req, res) => {
  try {
    const logDir = process.env.LOG_DIR || '/var/log/smtp-relay';
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(f => f.endsWith('.log'));
    
    const fileInfo = await Promise.all(
      logFiles.map(async (file) => {
        const stats = await fs.stat(path.join(logDir, file));
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime
        };
      })
    );
    
    res.json(fileInfo);
  } catch (error) {
    res.json([]);
  }
});

// Download log file
router.get('/download/:filename', async (req, res) => {
  try {
    const logDir = process.env.LOG_DIR || '/var/log/smtp-relay';
    const filePath = path.join(logDir, req.params.filename);
    
    // Security check - prevent path traversal
    if (!filePath.startsWith(logDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.send(content);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Get log statistics
router.get('/stats', (req, res) => {
  const logs = generateMockLogs(1000);
  
  res.json({
    total: logs.length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warn').length,
    info: logs.filter(l => l.level === 'info').length,
    debug: logs.filter(l => l.level === 'debug').length,
    lastHour: logs.filter(l => new Date(l.timestamp) > new Date(Date.now() - 3600000)).length,
    lastDay: logs.filter(l => new Date(l.timestamp) > new Date(Date.now() - 86400000)).length
  });
});

module.exports = router;