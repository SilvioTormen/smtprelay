const express = require('express');
const router = express.Router();

// Mock device storage (in production, use database)
let devices = [
  {
    id: '1',
    name: 'Office Printer',
    ip: '192.168.1.100',
    type: 'printer',
    status: 'active',
    lastSeen: new Date().toISOString(),
    emailsSent: 42,
    auth: 'none'
  },
  {
    id: '2',
    name: 'Scanner Room 2',
    ip: '192.168.1.101',
    type: 'scanner',
    status: 'inactive',
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    emailsSent: 15,
    auth: 'basic'
  }
];

// Get all devices
router.get('/', (req, res) => {
  res.json(devices);
});

// Get device by ID
router.get('/:id', (req, res) => {
  const device = devices.find(d => d.id === req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json(device);
});

// Add new device
router.post('/', (req, res) => {
  const newDevice = {
    id: Date.now().toString(),
    ...req.body,
    status: 'inactive',
    lastSeen: null,
    emailsSent: 0
  };
  devices.push(newDevice);
  res.status(201).json(newDevice);
});

// Update device
router.put('/:id', (req, res) => {
  const index = devices.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Device not found' });
  }
  devices[index] = { ...devices[index], ...req.body };
  res.json(devices[index]);
});

// Delete device
router.delete('/:id', (req, res) => {
  const index = devices.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Device not found' });
  }
  devices.splice(index, 1);
  res.status(204).send();
});

// Get device statistics
router.get('/:id/stats', (req, res) => {
  const device = devices.find(d => d.id === req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json({
    deviceId: device.id,
    totalEmails: device.emailsSent,
    successRate: 95 + Math.random() * 5,
    avgResponseTime: 50 + Math.random() * 100,
    lastHour: Math.floor(Math.random() * 10),
    lastDay: Math.floor(Math.random() * 100),
    lastWeek: Math.floor(Math.random() * 500)
  });
});

module.exports = router;