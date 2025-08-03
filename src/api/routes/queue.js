const express = require('express');
const router = express.Router();

// Mock queue storage
let queueItems = [];
let queueStatus = 'running';

// Generate mock queue items
const generateMockItems = () => {
  const statuses = ['pending', 'processing', 'completed', 'failed'];
  const items = [];
  
  for (let i = 0; i < 5; i++) {
    items.push({
      id: (Date.now() + i).toString(),
      messageId: `MSG-${Date.now()}-${i}`,
      from: `device${i}@example.com`,
      to: `recipient${i}@company.com`,
      subject: `Test Email ${i}`,
      size: Math.floor(Math.random() * 1000000),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      attempts: Math.floor(Math.random() * 3),
      queuedAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      nextRetry: new Date(Date.now() + Math.random() * 3600000).toISOString()
    });
  }
  
  return items;
};

// Initialize with mock data
queueItems = generateMockItems();

// Get queue items with stats
router.get('/', (req, res) => {
  const stats = {
    pending: queueItems.filter(i => i.status === 'pending').length,
    processing: queueItems.filter(i => i.status === 'processing').length,
    failed: queueItems.filter(i => i.status === 'failed').length,
    completed: queueItems.filter(i => i.status === 'completed').length
  };
  
  res.json({
    items: queueItems,
    stats,
    status: queueStatus
  });
});

// Retry message
router.post('/:id/retry', (req, res) => {
  const item = queueItems.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Queue item not found' });
  }
  
  item.status = 'pending';
  item.attempts += 1;
  item.nextRetry = new Date(Date.now() + 60000).toISOString();
  
  res.json({ success: true, item });
});

// Delete from queue
router.delete('/:id', (req, res) => {
  const index = queueItems.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Queue item not found' });
  }
  
  queueItems.splice(index, 1);
  res.status(204).send();
});

// Bulk operations
router.post('/bulk', (req, res) => {
  const { action, ids } = req.body;
  
  if (!action || !ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  
  let processed = 0;
  
  ids.forEach(id => {
    const item = queueItems.find(i => i.id === id);
    if (item) {
      if (action === 'retry') {
        item.status = 'pending';
        item.attempts += 1;
        item.nextRetry = new Date(Date.now() + 60000).toISOString();
        processed++;
      } else if (action === 'delete') {
        const index = queueItems.findIndex(i => i.id === id);
        if (index !== -1) {
          queueItems.splice(index, 1);
          processed++;
        }
      }
    }
  });
  
  res.json({ success: true, processed });
});

// Queue control
router.post('/control', (req, res) => {
  const { action } = req.body;
  
  if (action === 'running' || action === 'paused') {
    queueStatus = action;
    res.json({ success: true, status: queueStatus });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// Clear queue
router.delete('/clear', (req, res) => {
  queueItems = [];
  res.json({ success: true, cleared: true });
});

// Get queue statistics
router.get('/stats', (req, res) => {
  const now = Date.now();
  const hourAgo = now - 3600000;
  const dayAgo = now - 86400000;
  
  res.json({
    total: queueItems.length,
    pending: queueItems.filter(i => i.status === 'pending').length,
    processing: queueItems.filter(i => i.status === 'processing').length,
    failed: queueItems.filter(i => i.status === 'failed').length,
    completed: queueItems.filter(i => i.status === 'completed').length,
    lastHour: queueItems.filter(i => new Date(i.queuedAt).getTime() > hourAgo).length,
    lastDay: queueItems.filter(i => new Date(i.queuedAt).getTime() > dayAgo).length,
    avgProcessingTime: Math.floor(Math.random() * 5000) + 1000,
    successRate: 85 + Math.random() * 10
  });
});

module.exports = router;