const express = require('express');

function setupHealthCheck(port, logger) {
  const app = express();
  
  // Basic health check
  app.get('/health', (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    };
    
    res.json(health);
  });
  
  // Readiness check
  app.get('/ready', (req, res) => {
    // Check if Exchange connection is ready
    // This would be enhanced with actual checks
    res.json({ ready: true });
  });
  
  app.listen(port, () => {
    logger.info(`Health check endpoint listening on port ${port}`);
  });
}

module.exports = { setupHealthCheck };