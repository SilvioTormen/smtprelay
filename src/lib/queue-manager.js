const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class QueueManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.queueDir = config.queue?.directory || './queue';
    this.processing = false;
    this.interval = null;
  }
  
  async start() {
    // Ensure queue directory exists
    await fs.mkdir(this.queueDir, { recursive: true });
    
    // Process queue every 30 seconds
    this.interval = setInterval(() => this.processQueue(), 30000);
    
    // Process immediately on start
    this.processQueue();
    
    this.logger.info('Queue manager started');
  }
  
  stop(callback) {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.processing = false;
    if (callback) callback();
  }
  
  async queueMessage(data) {
    const messageId = uuidv4();
    const queueFile = path.join(this.queueDir, `${messageId}.json`);
    
    const queueData = {
      id: messageId,
      timestamp: Date.now(),
      attempts: 0,
      data: data
    };
    
    await fs.writeFile(queueFile, JSON.stringify(queueData, null, 2));
    this.logger.info(`Message ${messageId} queued`);
    
    return messageId;
  }
  
  async processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    
    try {
      const files = await fs.readdir(this.queueDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        await this.processQueuedMessage(file);
      }
    } catch (error) {
      this.logger.error(`Queue processing error: ${error.message}`);
    } finally {
      this.processing = false;
    }
  }
  
  async processQueuedMessage(filename) {
    const filePath = path.join(this.queueDir, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const queueData = JSON.parse(content);
      
      // Check if ready to retry
      const retryDelays = this.config.queue?.retry?.delays || [60, 300, 900, 3600, 7200];
      const delay = retryDelays[Math.min(queueData.attempts, retryDelays.length - 1)] * 1000;
      
      if (Date.now() - queueData.timestamp < delay) {
        return; // Not time to retry yet
      }
      
      // Try to send
      // This would integrate with RelayHandler
      // For now, just increment attempts
      
      queueData.attempts++;
      queueData.timestamp = Date.now();
      
      if (queueData.attempts >= (this.config.queue?.retry?.max_attempts || 5)) {
        // Move to failed queue
        const failedPath = path.join(this.queueDir, 'failed', filename);
        await fs.mkdir(path.join(this.queueDir, 'failed'), { recursive: true });
        await fs.rename(filePath, failedPath);
        this.logger.error(`Message ${queueData.id} failed after ${queueData.attempts} attempts`);
      } else {
        // Update queue file
        await fs.writeFile(filePath, JSON.stringify(queueData, null, 2));
        this.logger.info(`Retry attempt ${queueData.attempts} for message ${queueData.id}`);
      }
    } catch (error) {
      this.logger.error(`Error processing queued message ${filename}: ${error.message}`);
    }
  }
}

module.exports = { QueueManager };