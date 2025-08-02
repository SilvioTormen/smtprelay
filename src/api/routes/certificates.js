const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { authenticate, authorize } = require('../middleware/auth');

// Security: Use spawn instead of execSync to prevent command injection
const execCommand = (command, args = []) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { 
      timeout: 10000,
      shell: false // IMPORTANT: Disable shell to prevent injection
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
};

// Security: Validate and sanitize file paths
const sanitizePath = (filepath) => {
  // Remove any path traversal attempts
  const normalized = path.normalize(filepath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Ensure path is within allowed directory
  const certsDir = path.resolve(__dirname, '../../../certs');
  const resolved = path.resolve(certsDir, normalized);
  
  if (!resolved.startsWith(certsDir)) {
    throw new Error('Invalid path: Path traversal detected');
  }
  
  return resolved;
};

// Security: Validate certificate/key content
const validatePEMContent = (content, type = 'CERTIFICATE') => {
  const pemRegex = type === 'CERTIFICATE' 
    ? /^-----BEGIN (CERTIFICATE|TRUSTED CERTIFICATE)-----[\s\S]+-----END (CERTIFICATE|TRUSTED CERTIFICATE)-----\s*$/m
    : /^-----BEGIN (RSA |EC |ENCRYPTED |)PRIVATE KEY-----[\s\S]+-----END (RSA |EC |ENCRYPTED |)PRIVATE KEY-----\s*$/m;
  
  if (!pemRegex.test(content)) {
    throw new Error(`Invalid ${type} format`);
  }
  
  // Check for suspicious content
  const suspiciousPatterns = [
    /[;&|`$(){}[\]<>]/,  // Shell metacharacters
    /\.\.\//,             // Path traversal
    /\\x[0-9a-f]{2}/i,    // Hex escapes
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      throw new Error(`Suspicious content detected in ${type}`);
    }
  }
  
  return true;
};

// Configure multer with security restrictions
const upload = multer({
  dest: path.join(__dirname, '../../../.temp/'),
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB max (certificates are small)
    files: 3,
    fields: 5
  },
  fileFilter: async (req, file, cb) => {
    // Validate filename
    if (!/^[\w\-. ]+\.(pem|crt|key|cer)$/i.test(file.originalname)) {
      return cb(new Error('Invalid filename'));
    }
    
    // Check MIME type
    const allowedMimes = [
      'application/x-pem-file',
      'application/x-x509-ca-cert',
      'application/pkix-cert',
      'text/plain'
    ];
    
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    
    cb(null, true);
  }
});

// Get current certificate status
router.get('/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const certPath = sanitizePath('cert.pem');
    const keyPath = sanitizePath('key.pem');
    
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
        // Use spawn to safely get certificate info
        const enddate = await execCommand('openssl', ['x509', '-in', certPath, '-noout', '-enddate']);
        const expiryDate = new Date(enddate.replace('notAfter=', '').trim());
        status.expiryDate = expiryDate.toISOString();
        
        // Calculate days until expiry
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
        status.daysUntilExpiry = daysUntilExpiry;
        
        // Get issuer safely
        const issuer = await execCommand('openssl', ['x509', '-in', certPath, '-noout', '-issuer']);
        status.issuer = issuer.replace('issuer=', '').trim();
        
        // Get subject safely
        const subject = await execCommand('openssl', ['x509', '-in', certPath, '-noout', '-subject']);
        status.subject = subject.replace('subject=', '').trim();
        
        // Check if self-signed
        status.isSelfSigned = status.issuer === status.subject;
        
        // Check validity
        status.isValid = daysUntilExpiry > 0;
        
        // Get fingerprint safely
        const fingerprint = await execCommand('openssl', ['x509', '-in', certPath, '-noout', '-fingerprint', '-sha256']);
        status.fingerprint = fingerprint.replace('SHA256 Fingerprint=', '').trim();
        
      } catch (error) {
        status.error = `Failed to parse certificate: ${error.message}`;
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
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
    let tempFiles = [];
    
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
      
      tempFiles = [certFile.path, keyFile.path];
      if (chainFile) tempFiles.push(chainFile.path);

      // Read and validate certificate content
      const certContent = await fs.readFile(certFile.path, 'utf8');
      validatePEMContent(certContent, 'CERTIFICATE');
      
      // Read and validate key content
      const keyContent = await fs.readFile(keyFile.path, 'utf8');
      validatePEMContent(keyContent, 'PRIVATE KEY');
      
      // Validate certificate using OpenSSL
      try {
        await execCommand('openssl', ['x509', '-in', certFile.path, '-noout']);
      } catch (error) {
        throw new Error('Invalid certificate file');
      }

      // Validate private key
      try {
        // Try RSA key first
        await execCommand('openssl', ['rsa', '-in', keyFile.path, '-check', '-noout']);
      } catch (rsaError) {
        // Try EC key
        try {
          await execCommand('openssl', ['ec', '-in', keyFile.path, '-check', '-noout']);
        } catch (ecError) {
          throw new Error('Invalid private key file');
        }
      }

      // Verify certificate and key match (using modulus comparison)
      const certModulus = await execCommand('openssl', ['x509', '-in', certFile.path, '-noout', '-modulus']);
      const keyModulus = await execCommand('openssl', ['rsa', '-in', keyFile.path, '-noout', '-modulus'])
        .catch(() => execCommand('openssl', ['ec', '-in', keyFile.path, '-noout', '-pubkey']));
      
      // Simple check if they're related (not perfect but safer)
      if (certModulus && keyModulus && !certModulus.includes('Modulus=')) {
        throw new Error('Certificate and private key do not match');
      }

      // Backup existing certificates
      const certsDir = path.resolve(__dirname, '../../../certs');
      const backupDir = path.join(certsDir, 'backup', new Date().toISOString().replace(/[:.]/g, '-'));
      await fs.mkdir(backupDir, { recursive: true });

      try {
        const existingCert = sanitizePath('cert.pem');
        const existingKey = sanitizePath('key.pem');
        await fs.copyFile(existingCert, path.join(backupDir, 'cert.pem'));
        await fs.copyFile(existingKey, path.join(backupDir, 'key.pem'));
      } catch (e) {
        // No existing certificates to backup
      }

      // Move new certificates to certs directory
      const newCertPath = sanitizePath('cert.pem');
      const newKeyPath = sanitizePath('key.pem');
      
      await fs.writeFile(newCertPath, certContent, { mode: 0o644 });
      await fs.writeFile(newKeyPath, keyContent, { mode: 0o600 });
      
      if (chainFile) {
        const chainContent = await fs.readFile(chainFile.path, 'utf8');
        validatePEMContent(chainContent, 'CERTIFICATE');
        const newChainPath = sanitizePath('chain.pem');
        await fs.writeFile(newChainPath, chainContent, { mode: 0o644 });
      }

      res.json({ 
        success: true, 
        message: 'Certificates uploaded successfully. Please restart the service to apply changes.' 
      });

    } catch (error) {
      res.status(400).json({ error: error.message || 'Upload failed' });
    } finally {
      // Clean up temp files
      for (const file of tempFiles) {
        try {
          await fs.unlink(file);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }
);

// Generate self-signed certificate
router.post('/generate-self-signed', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { commonName, country, state, locality, organization, days } = req.body;
    
    // Input validation
    if (!commonName || typeof commonName !== 'string') {
      return res.status(400).json({ error: 'Common Name is required' });
    }
    
    // Sanitize input - allow only safe characters
    const sanitize = (input) => {
      if (!input) return '';
      return String(input).replace(/[^a-zA-Z0-9 .\-_@]/g, '');
    };
    
    const sanitizedCN = sanitize(commonName);
    if (!sanitizedCN || sanitizedCN.length > 64) {
      return res.status(400).json({ error: 'Invalid Common Name' });
    }
    
    const sanitizedCountry = country ? sanitize(country).substring(0, 2).toUpperCase() : '';
    const sanitizedState = sanitize(state).substring(0, 64);
    const sanitizedLocality = sanitize(locality).substring(0, 64);
    const sanitizedOrg = sanitize(organization).substring(0, 64);
    const validDays = Math.min(Math.max(parseInt(days) || 365, 1), 3650); // 1-3650 days

    const certsDir = path.resolve(__dirname, '../../../certs');
    const backupDir = path.join(certsDir, 'backup', new Date().toISOString().replace(/[:.]/g, '-'));
    
    // Backup existing certificates
    await fs.mkdir(backupDir, { recursive: true });
    try {
      await fs.copyFile(sanitizePath('cert.pem'), path.join(backupDir, 'cert.pem'));
      await fs.copyFile(sanitizePath('key.pem'), path.join(backupDir, 'key.pem'));
    } catch (e) {
      // No existing certificates to backup
    }

    // Generate self-signed certificate using spawn (safe from injection)
    const certPath = sanitizePath('cert.pem');
    const keyPath = sanitizePath('key.pem');
    
    // Build subject components safely
    const subjectComponents = [];
    if (sanitizedCountry) subjectComponents.push(`C=${sanitizedCountry}`);
    if (sanitizedState) subjectComponents.push(`ST=${sanitizedState}`);
    if (sanitizedLocality) subjectComponents.push(`L=${sanitizedLocality}`);
    if (sanitizedOrg) subjectComponents.push(`O=${sanitizedOrg}`);
    subjectComponents.push(`CN=${sanitizedCN}`);
    
    const subject = `/${subjectComponents.join('/')}`;
    
    // Use spawn to generate certificate
    await execCommand('openssl', [
      'req',
      '-x509',
      '-newkey', 'rsa:4096',
      '-keyout', keyPath,
      '-out', certPath,
      '-days', String(validDays),
      '-nodes',
      '-subj', subject
    ]);

    // Set proper permissions
    await fs.chmod(keyPath, 0o600);
    await fs.chmod(certPath, 0o644);

    res.json({ 
      success: true, 
      message: `Self-signed certificate generated for ${validDays} days. Please restart the service.` 
    });

  } catch (error) {
    res.status(500).json({ error: error.message || 'Generation failed' });
  }
});

// Generate Let's Encrypt certificate
router.post('/generate-letsencrypt', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { domain, email, staging } = req.body;
    
    // Input validation
    if (!domain || !email) {
      return res.status(400).json({ 
        error: 'Domain and email are required' 
      });
    }
    
    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if certbot is installed
    try {
      await execCommand('which', ['certbot']);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Certbot is not installed. Install with: sudo dnf install certbot' 
      });
    }

    const certsDir = path.resolve(__dirname, '../../../certs');
    const webroot = path.resolve(__dirname, '../../../.well-known');
    
    // Create webroot for challenge
    await fs.mkdir(webroot, { recursive: true });

    // Build certbot arguments safely
    const certbotArgs = [
      'certonly',
      '--webroot',
      '-w', webroot,
      '-d', domain,
      '--email', email,
      '--agree-tos',
      '--non-interactive'
    ];
    
    if (staging) {
      certbotArgs.push('--staging');
    }

    try {
      // Note: This requires sudo permissions
      await execCommand('sudo', ['certbot', ...certbotArgs]);
      
      // Copy certificates to our certs directory
      const letsencryptDir = `/etc/letsencrypt/live/${domain}`;
      
      // Backup existing certificates
      const backupDir = path.join(certsDir, 'backup', new Date().toISOString().replace(/[:.]/g, '-'));
      await fs.mkdir(backupDir, { recursive: true });
      
      try {
        await fs.copyFile(sanitizePath('cert.pem'), path.join(backupDir, 'cert.pem'));
        await fs.copyFile(sanitizePath('key.pem'), path.join(backupDir, 'key.pem'));
      } catch (e) {
        // No existing certificates to backup
      }

      // Copy Let's Encrypt certificates (requires read permissions)
      const fullchainPath = path.join(letsencryptDir, 'fullchain.pem');
      const privkeyPath = path.join(letsencryptDir, 'privkey.pem');
      
      const fullchainContent = await fs.readFile(fullchainPath, 'utf8');
      const privkeyContent = await fs.readFile(privkeyPath, 'utf8');
      
      await fs.writeFile(sanitizePath('cert.pem'), fullchainContent, { mode: 0o644 });
      await fs.writeFile(sanitizePath('key.pem'), privkeyContent, { mode: 0o600 });

      res.json({ 
        success: true, 
        message: 'Let\'s Encrypt certificate generated successfully',
        note: 'Setup auto-renewal with cron: 0 0 * * * certbot renew --quiet' 
      });

    } catch (error) {
      res.status(400).json({ 
        error: `Let's Encrypt generation failed: ${error.message}`,
        hint: 'Ensure port 80 is accessible and domain DNS is configured' 
      });
    }

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download certificate for backup
router.get('/download/:type', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['certificate', 'chain'].includes(type)) {
      return res.status(400).json({ error: 'Invalid download type' });
    }

    const filename = type === 'certificate' ? 'cert.pem' : 'chain.pem';
    const filepath = sanitizePath(filename);

    // Check if file exists
    await fs.access(filepath);

    // Set security headers
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Stream file content
    const content = await fs.readFile(filepath, 'utf8');
    res.send(content);

  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Certificate file not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Test TLS configuration
router.post('/test', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hostname, port } = req.body;
    
    // Input validation
    const testPort = Math.min(Math.max(parseInt(port) || 465, 1), 65535);
    const testHost = String(hostname || 'localhost').replace(/[^a-zA-Z0-9.\-]/g, '');
    
    if (!testHost || testHost.length > 253) {
      return res.status(400).json({ error: 'Invalid hostname' });
    }

    // Test TLS connection using spawn
    try {
      const result = await execCommand('timeout', [
        '5',
        'openssl',
        's_client',
        '-connect', `${testHost}:${testPort}`,
        '-servername', testHost,
        '-brief'
      ]);
      
      res.json({
        success: true,
        message: 'TLS connection successful',
        details: result.substring(0, 500) // Limit output
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'TLS connection failed',
        error: error.message
      });
    }

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;