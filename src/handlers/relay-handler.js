const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { v4: uuidv4 } = require('uuid');
const { ExchangeAuth } = require('../auth/exchange-auth');

class RelayHandler {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.exchangeAuth = new ExchangeAuth(config, logger);
    this.transporter = null;
    
    this.initializeTransporter();
  }
  
  async initializeTransporter() {
    try {
      // Get auth configuration for Exchange Online
      const authConfig = await this.exchangeAuth.getAuthConfig();
      
      this.transporter = nodemailer.createTransport({
        host: this.config.exchange_online.host,
        port: this.config.exchange_online.port,
        secure: false, // Use STARTTLS
        requireTLS: true,
        auth: authConfig,
        tls: {
          minVersion: 'TLSv1.2',
          ciphers: 'HIGH'
        },
        logger: this.config.logging.level === 'debug',
        debug: this.config.logging.level === 'debug'
      });
      
      // Verify connection
      await this.transporter.verify();
      this.logger.info('Exchange Online connection verified');
    } catch (error) {
      this.logger.error(`Failed to connect to Exchange Online: ${error.message}`);
      // Retry connection every 60 seconds
      setTimeout(() => this.initializeTransporter(), 60000);
    }
  }
  
  checkRecipient(recipient) {
    // Check if recipient domain is allowed
    const allowedDomains = this.config.relay?.allowed_recipient_domains || [];
    
    // If no restrictions, allow all
    if (allowedDomains.length === 0 || allowedDomains.includes('*')) {
      return true;
    }
    
    const domain = recipient.split('@')[1];
    return allowedDomains.includes(domain);
  }
  
  async processMessage(stream, session, callback) {
    const chunks = [];
    
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', async () => {
      try {
        const message = Buffer.concat(chunks);
        
        // Parse the message
        const parsed = await simpleParser(message);
        
        // Apply header rewriting for legacy devices
        const headers = this.rewriteHeaders(parsed, session);
        
        // Build the message for relay
        const mailOptions = {
          from: headers.from || session.envelope.from,
          to: session.envelope.to,
          subject: parsed.subject || '(no subject)',
          text: parsed.text,
          html: parsed.html,
          attachments: parsed.attachments,
          headers: headers.custom,
          messageId: headers.messageId,
          date: headers.date
        };
        
        // Check if transporter is ready
        if (!this.transporter) {
          this.logger.error('Exchange transporter not ready, queueing message');
          return this.queueMessage(mailOptions, callback);
        }
        
        // Send through Exchange Online
        const info = await this.transporter.sendMail(mailOptions);
        
        this.logger.info(`Message relayed successfully: ${info.messageId}`);
        
        // Log per device if configured
        if (this.config.logging.log_per_device) {
          this.logDeviceActivity(session.remoteAddress, 'success', info.messageId);
        }
        
        callback();
      } catch (error) {
        this.logger.error(`Failed to relay message: ${error.message}`);
        
        // Queue for retry
        this.queueMessage({
          envelope: session.envelope,
          message: Buffer.concat(chunks),
          error: error.message
        }, callback);
      }
    });
  }
  
  rewriteHeaders(parsed, session) {
    const headers = {
      custom: {}
    };
    
    // Add Message-ID if missing
    if (!parsed.messageId && this.config.relay?.header_rewrite?.add_message_id) {
      headers.messageId = `<${uuidv4()}@${this.config.hostname || 'smtp-relay.local'}>`;
      this.logger.debug(`Added Message-ID: ${headers.messageId}`);
    } else {
      headers.messageId = parsed.messageId;
    }
    
    // Add Date if missing
    if (!parsed.date && this.config.relay?.header_rewrite?.add_date) {
      headers.date = new Date();
      this.logger.debug('Added Date header');
    } else {
      headers.date = parsed.date;
    }
    
    // Fix From address if needed
    let fromAddress = parsed.from?.text || session.envelope.from;
    
    if (this.config.relay?.header_rewrite?.fix_from) {
      // Check if From is empty or invalid
      if (!fromAddress || fromAddress === '<>') {
        fromAddress = this.config.relay.header_rewrite.default_from;
        this.logger.info(`Replaced empty From with: ${fromAddress}`);
      } else if (!fromAddress.includes('@')) {
        // Add domain if missing
        const defaultDomain = this.config.relay.header_rewrite.default_from.split('@')[1];
        fromAddress = `${fromAddress}@${defaultDomain}`;
        this.logger.info(`Fixed From address: ${fromAddress}`);
      }
    }
    
    headers.from = fromAddress;
    
    // Add Received header for tracking
    if (this.config.relay?.header_rewrite?.add_received) {
      headers.custom['X-Relay-From'] = session.remoteAddress;
      headers.custom['X-Relay-Time'] = new Date().toISOString();
      headers.custom['X-Relay-Port'] = session.server?.address()?.port || 'unknown';
    }
    
    return headers;
  }
  
  queueMessage(data, callback) {
    // This would integrate with QueueManager
    // For now, just log and fail
    this.logger.error('Message queued for retry');
    callback(new Error('Message queued for retry'));
  }
  
  logDeviceActivity(ip, status, messageId) {
    const logFile = `/var/log/smtp-relay/device-${ip.replace(/[.:]/g, '-')}.log`;
    const logEntry = `${new Date().toISOString()} ${status} ${messageId || 'no-id'}\n`;
    
    require('fs').appendFileSync(logFile, logEntry);
  }
}

module.exports = { RelayHandler };