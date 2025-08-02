const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { authenticate, authorize } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../../.temp/'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only PEM files
    if (file.mimetype === 'application/x-pem-file' || 
        file.mimetype === 'application/x-x509-ca-cert' ||
        file.originalname.endsWith('.pem') ||
        file.originalname.endsWith('.crt') ||
        file.originalname.endsWith('.key')) {
      cb(null, true);
    } else {
      cb(new Error('Only PEM files are allowed'));
    }
  }
});

/**
 * Certificate Management API
 * Allows admins to manage TLS certificates through the dashboard
 */

// Get current certificate status
router.get('/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const certPath = path.join(__dirname, '../../../certs/cert.pem');
    const keyPath = path.join(__dirname, '../../../certs/key.pem');
    
    const status = {
      hasCertificate: false,
      hasPrivateKey: false,
      certificateInfo: null,
      expiryDate: null,
      daysUntilExpiry: null,
      issuer: null,
      subject: null,
      isValid: false,
      isSelfSigned: false,
      error: null
    };

    // Check if files exist
    try {
      await fs.access(certPath);
      status.hasCertificate = true;
    } catch (e) {
      // Certificate doesn't exist
    }

    try {
      await fs.access(keyPath);
      status.hasPrivateKey = true;
    } catch (e) {
      // Key doesn't exist
    }

    // Get certificate details if it exists
    if (status.hasCertificate) {
      try {
        // Get certificate info using OpenSSL
        const certInfo = execSync(`openssl x509 -in ${certPath} -noout -text`, { encoding: 'utf8' });
        
        // Extract expiry date
        const expiryMatch = execSync(`openssl x509 -in ${certPath} -noout -enddate`, { encoding: 'utf8' });
        const expiryDate = new Date(expiryMatch.replace('notAfter=', '').trim());
        status.expiryDate = expiryDate.toISOString();
        
        // Calculate days until expiry
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
        status.daysUntilExpiry = daysUntilExpiry;
        
        // Get issuer
        const issuerMatch = execSync(`openssl x509 -in ${certPath} -noout -issuer`, { encoding: 'utf8' });
        status.issuer = issuerMatch.replace('issuer=', '').trim();
        
        // Get subject
        const subjectMatch = execSync(`openssl x509 -in ${certPath} -noout -subject`, { encoding: 'utf8' });
        status.subject = subjectMatch.replace('subject=', '').trim();
        
        // Check if self-signed
        status.isSelfSigned = status.issuer === status.subject;
        
        // Check validity
        status.isValid = daysUntilExpiry > 0;
        
        // Get fingerprint
        const fingerprint = execSync(`openssl x509 -in ${certPath} -noout -fingerprint -sha256`, { encoding: 'utf8' });
        status.fingerprint = fingerprint.replace('SHA256 Fingerprint=', '').trim();
        
        // Get SANs (Subject Alternative Names)
        try {
          const sans = execSync(`openssl x509 -in ${certPath} -noout -ext subjectAltName`, { encoding: 'utf8' });
          const sanLines = sans.split('\n').filter(line => line.includes('DNS:'));
          if (sanLines.length > 0) {
            status.alternativeNames = sanLines.join(' ').match(/DNS:[^\s,]+/g)?.map(s => s.replace('DNS:', ''));
          }
        } catch (e) {
          // No SANs
        }
        
      } catch (error) {
        status.error = `Failed to parse certificate: ${error.message}`;
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload new certificate and key
router.post('/upload', 
  authenticate, 
  authorize('admin'),
  upload.fields([
    { name: 'certificate', maxCount: 1 },
    { name: 'privateKey', maxCount: 1 },
    { name: 'chain', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const files = req.files;
      
      if (!files.certificate || !files.privateKey) {
        return res.status(400).json({ 
          error: 'Both certificate and private key are required' 
        });
      }

      const certFile = files.certificate[0];
      const keyFile = files.privateKey[0];
      const chainFile = files.chain ? files.chain[0] : null;

      // Validate certificate
      try {
        execSync(`openssl x509 -in ${certFile.path} -noout`, { stdio: 'ignore' });
      } catch (error) {
        await fs.unlink(certFile.path);
        await fs.unlink(keyFile.path);
        if (chainFile) await fs.unlink(chainFile.path);
        return res.status(400).json({ error: 'Invalid certificate file' });
      }

      // Validate private key
      try {
        execSync(`openssl rsa -in ${keyFile.path} -check -noout`, { stdio: 'ignore' });
      } catch (error) {
        // Try EC key
        try {
          execSync(`openssl ec -in ${keyFile.path} -check -noout`, { stdio: 'ignore' });
        } catch (ecError) {
          await fs.unlink(certFile.path);
          await fs.unlink(keyFile.path);
          if (chainFile) await fs.unlink(chainFile.path);
          return res.status(400).json({ error: 'Invalid private key file' });
        }
      }

      // Verify certificate and key match
      const certModulus = execSync(`openssl x509 -in ${certFile.path} -noout -modulus | openssl md5`, { encoding: 'utf8' }).trim();
      const keyModulus = execSync(`openssl rsa -in ${keyFile.path} -noout -modulus 2>/dev/null | openssl md5 || openssl ec -in ${keyFile.path} -noout 2>/dev/null`, { encoding: 'utf8' }).trim();
      
      if (certModulus !== keyModulus && keyModulus !== '') {
        await fs.unlink(certFile.path);
        await fs.unlink(keyFile.path);
        if (chainFile) await fs.unlink(chainFile.path);
        return res.status(400).json({ error: 'Certificate and private key do not match' });
      }

      // Backup existing certificates
      const certsDir = path.join(__dirname, '../../../certs');
      const backupDir = path.join(certsDir, 'backup', new Date().toISOString().replace(/:/g, '-'));
      await fs.mkdir(backupDir, { recursive: true });

      try {
        await fs.copyFile(path.join(certsDir, 'cert.pem'), path.join(backupDir, 'cert.pem'));
        await fs.copyFile(path.join(certsDir, 'key.pem'), path.join(backupDir, 'key.pem'));
      } catch (e) {
        // No existing certificates to backup
      }

      // Move new certificates to certs directory
      await fs.rename(certFile.path, path.join(certsDir, 'cert.pem'));
      await fs.rename(keyFile.path, path.join(certsDir, 'key.pem'));
      
      if (chainFile) {
        await fs.rename(chainFile.path, path.join(certsDir, 'chain.pem'));
      }

      // Set proper permissions
      await fs.chmod(path.join(certsDir, 'key.pem'), 0o600);
      await fs.chmod(path.join(certsDir, 'cert.pem'), 0o644);
      if (chainFile) {
        await fs.chmod(path.join(certsDir, 'chain.pem'), 0o644);
      }

      res.json({ 
        success: true, 
        message: 'Certificates uploaded successfully. Please restart the service to apply changes.' 
      });

    } catch (error) {
      // Clean up temp files on error
      if (req.files) {
        for (const field in req.files) {
          for (const file of req.files[field]) {
            try {
              await fs.unlink(file.path);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }
      }
      
      res.status(500).json({ error: error.message });
    }
  }
);

// Generate self-signed certificate
router.post('/generate-self-signed', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { commonName, country, state, locality, organization, days } = req.body;
    
    // Validate input
    if (!commonName) {
      return res.status(400).json({ error: 'Common Name is required' });
    }

    const certsDir = path.join(__dirname, '../../../certs');
    const backupDir = path.join(certsDir, 'backup', new Date().toISOString().replace(/:/g, '-'));
    
    // Backup existing certificates
    await fs.mkdir(backupDir, { recursive: true });
    try {
      await fs.copyFile(path.join(certsDir, 'cert.pem'), path.join(backupDir, 'cert.pem'));
      await fs.copyFile(path.join(certsDir, 'key.pem'), path.join(backupDir, 'key.pem'));
    } catch (e) {
      // No existing certificates to backup
    }

    // Build subject string
    const subjectParts = [];
    if (country) subjectParts.push(`/C=${country}`);
    if (state) subjectParts.push(`/ST=${state}`);
    if (locality) subjectParts.push(`/L=${locality}`);
    if (organization) subjectParts.push(`/O=${organization}`);
    subjectParts.push(`/CN=${commonName}`);
    const subject = subjectParts.join('');

    // Generate self-signed certificate
    const validDays = days || 365;
    const command = `openssl req -x509 -newkey rsa:4096 -keyout ${certsDir}/key.pem -out ${certsDir}/cert.pem -days ${validDays} -nodes -subj "${subject}"`;
    
    execSync(command, { stdio: 'ignore' });

    // Set proper permissions
    await fs.chmod(path.join(certsDir, 'key.pem'), 0o600);
    await fs.chmod(path.join(certsDir, 'cert.pem'), 0o644);

    res.json({ 
      success: true, 
      message: `Self-signed certificate generated for ${validDays} days. Please restart the service to apply changes.` 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Let's Encrypt certificate (requires domain validation)
router.post('/generate-letsencrypt', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { domain, email, staging } = req.body;
    
    if (!domain || !email) {
      return res.status(400).json({ 
        error: 'Domain and email are required for Let\'s Encrypt' 
      });
    }

    // Check if certbot is installed
    try {
      execSync('which certbot', { stdio: 'ignore' });
    } catch (error) {
      return res.status(400).json({ 
        error: 'Certbot is not installed. Please install it first: sudo dnf install certbot' 
      });
    }

    const certsDir = path.join(__dirname, '../../../certs');
    const webroot = path.join(__dirname, '../../../.well-known');
    
    // Create webroot for challenge
    await fs.mkdir(webroot, { recursive: true });

    // Build certbot command
    const stagingFlag = staging ? '--staging' : '';
    const command = `sudo certbot certonly --webroot -w ${webroot} -d ${domain} --email ${email} --agree-tos --non-interactive ${stagingFlag}`;

    try {
      const output = execSync(command, { encoding: 'utf8' });
      
      // Copy certificates to our certs directory
      const letsencryptDir = `/etc/letsencrypt/live/${domain}`;
      
      // Backup existing certificates
      const backupDir = path.join(certsDir, 'backup', new Date().toISOString().replace(/:/g, '-'));
      await fs.mkdir(backupDir, { recursive: true });
      
      try {
        await fs.copyFile(path.join(certsDir, 'cert.pem'), path.join(backupDir, 'cert.pem'));
        await fs.copyFile(path.join(certsDir, 'key.pem'), path.join(backupDir, 'key.pem'));
      } catch (e) {
        // No existing certificates to backup
      }

      // Copy Let's Encrypt certificates
      await fs.copyFile(`${letsencryptDir}/fullchain.pem`, path.join(certsDir, 'cert.pem'));
      await fs.copyFile(`${letsencryptDir}/privkey.pem`, path.join(certsDir, 'key.pem'));
      
      // Set proper permissions
      await fs.chmod(path.join(certsDir, 'key.pem'), 0o600);
      await fs.chmod(path.join(certsDir, 'cert.pem'), 0o644);

      // Setup auto-renewal
      const renewCommand = `0 0 * * * certbot renew --quiet && cp ${letsencryptDir}/fullchain.pem ${certsDir}/cert.pem && cp ${letsencryptDir}/privkey.pem ${certsDir}/key.pem && systemctl reload smtp-relay`;
      
      res.json({ 
        success: true, 
        message: 'Let\'s Encrypt certificate generated successfully',
        renewCommand: renewCommand,
        note: 'Add the renewal command to crontab for automatic renewal' 
      });

    } catch (error) {
      res.status(400).json({ 
        error: `Let's Encrypt generation failed: ${error.message}`,
        hint: 'Make sure port 80 is accessible from the internet for domain validation' 
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download certificate (for backup)
router.get('/download/:type', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['certificate', 'chain'].includes(type)) {
      return res.status(400).json({ error: 'Invalid download type' });
    }

    const certsDir = path.join(__dirname, '../../../certs');
    const filename = type === 'certificate' ? 'cert.pem' : 'chain.pem';
    const filepath = path.join(certsDir, filename);

    // Check if file exists
    await fs.access(filepath);

    // Send file
    res.download(filepath, filename);

  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Certificate file not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Test TLS configuration
router.post('/test', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hostname, port } = req.body;
    const testPort = port || 465; // Default to SMTPS port
    const testHost = hostname || 'localhost';

    // Test TLS connection
    const command = `echo | openssl s_client -connect ${testHost}:${testPort} -servername ${testHost} 2>/dev/null | openssl x509 -noout -subject -issuer -dates`;
    
    try {
      const output = execSync(command, { encoding: 'utf8', timeout: 5000 });
      
      res.json({
        success: true,
        message: 'TLS connection successful',
        details: output
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'TLS connection failed',
        error: error.message
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;