const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { authenticate, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for certificate operations
const certRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many certificate operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// File operation lock to prevent race conditions
const fileLocks = new Map();

const acquireLock = async (resource) => {
  const lockId = crypto.randomBytes(16).toString('hex');
  
  while (fileLocks.has(resource)) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  fileLocks.set(resource, lockId);
  return lockId;
};

const releaseLock = (resource, lockId) => {
  if (fileLocks.get(resource) === lockId) {
    fileLocks.delete(resource);
  }
};

// Security: Use spawn instead of execSync to prevent command injection
const execCommand = (command, args = [], options = {}) => {
  return new Promise((resolve, reject) => {
    // Set strict timeout
    const timeout = options.timeout || 5000; // 5 seconds default
    
    const proc = spawn(command, args, { 
      timeout,
      shell: false, // IMPORTANT: Disable shell to prevent injection
      uid: process.getuid ? process.getuid() : undefined, // Run as current user
      gid: process.getgid ? process.getgid() : undefined,
    });
    
    let stdout = '';
    let stderr = '';
    let dataSize = 0;
    const maxOutput = 50 * 1024; // 50KB max output
    
    proc.stdout.on('data', (data) => {
      dataSize += data.length;
      if (dataSize > maxOutput) {
        proc.kill();
        reject(new Error('Command output too large'));
        return;
      }
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed: ${stderr || 'Unknown error'}`));
      }
    });
    
    proc.on('error', reject);
  });
};

// Security: Validate and sanitize file paths with additional checks
const sanitizePath = async (filepath) => {
  // Strict validation: only allow specific filenames
  const allowedFiles = ['cert.pem', 'key.pem', 'chain.pem', 'ca.pem'];
  
  // Extract basename and validate against whitelist
  const basename = path.basename(filepath);
  if (!allowedFiles.includes(basename)) {
    throw new Error('Invalid filename');
  }
  
  // Get the certificates directory
  const certsDir = path.resolve(__dirname, '../../../certs');
  
  // Build the full path using only the validated basename
  const resolved = path.join(certsDir, basename);
  
  // Double-check the resolved path is within certs directory
  const realCertsDir = await fs.realpath(certsDir).catch(() => certsDir);
  const resolvedParent = path.dirname(resolved);
  
  if (resolvedParent !== realCertsDir && resolvedParent !== certsDir) {
    throw new Error('Invalid path');
  }
  
  // Check for symlinks
  try {
    const stats = await fs.lstat(resolved);
    if (stats.isSymbolicLink()) {
      // Resolve the symlink and check it's still within bounds
      const realPath = await fs.realpath(resolved);
      if (!realPath.startsWith(realCertsDir)) {
        throw new Error('Symlinks must point within certs directory');
      }
    }
  } catch (e) {
    // File doesn't exist yet, which is okay for write operations
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }
  
  return resolved;
};

// Validate certificate algorithms and key strength
const validateCertificateSecurity = async (certPath) => {
  try {
    // Check signature algorithm
    const sigAlg = await execCommand('openssl', [
      'x509', '-in', certPath, '-noout', '-text'
    ]);
    
    // Reject weak algorithms
    if (/md5|sha1/i.test(sigAlg)) {
      throw new Error('Certificate uses weak signature algorithm');
    }
    
    // Check key size
    if (/RSA Public-Key: \((\d+) bit\)/.test(sigAlg)) {
      const keySize = parseInt(RegExp.$1);
      if (keySize < 2048) {
        throw new Error('RSA key size must be at least 2048 bits');
      }
    }
    
    return true;
  } catch (error) {
    throw new Error(`Certificate validation failed: ${error.message}`);
  }
};

// Clean up old backups to prevent resource exhaustion
const cleanOldBackups = async () => {
  const certsDir = path.resolve(__dirname, '../../../certs');
  const backupDir = path.join(certsDir, 'backup');
  const maxBackups = 10;
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  try {
    const backups = await fs.readdir(backupDir);
    const now = Date.now();
    
    // Sort by creation time
    const backupStats = await Promise.all(
      backups.map(async (name) => {
        const fullPath = path.join(backupDir, name);
        const stats = await fs.stat(fullPath);
        return { name, path: fullPath, time: stats.mtimeMs };
      })
    );
    
    backupStats.sort((a, b) => b.time - a.time);
    
    // Remove old backups
    for (let i = 0; i < backupStats.length; i++) {
      const backup = backupStats[i];
      
      // Keep recent backups up to limit
      if (i < maxBackups && (now - backup.time) < maxAge) {
        continue;
      }
      
      // Remove old backup
      await fs.rm(backup.path, { recursive: true, force: true });
    }
  } catch (e) {
    // Ignore cleanup errors
  }
};

// Security: Validate certificate/key content with strict checks
const validatePEMContent = (content, type = 'CERTIFICATE') => {
  // Check size limits
  if (content.length > 100 * 1024) { // 100KB max
    throw new Error(`${type} file too large`);
  }
  
  // Strict PEM validation
  const pemRegex = type === 'CERTIFICATE' 
    ? /^-----BEGIN (CERTIFICATE|TRUSTED CERTIFICATE)-----\r?\n[\s\S]+?\r?\n-----END (CERTIFICATE|TRUSTED CERTIFICATE)-----\r?\n?$/m
    : /^-----BEGIN (RSA |EC |ENCRYPTED |)?PRIVATE KEY-----\r?\n[\s\S]+?\r?\n-----END (RSA |EC |ENCRYPTED |)?PRIVATE KEY-----\r?\n?$/m;
  
  if (!pemRegex.test(content)) {
    throw new Error(`Invalid ${type} format`);
  }
  
  // Check for suspicious content
  const suspiciousPatterns = [
    /[;&|`$(){}[\]<>\\]/,  // Shell metacharacters
    /\.\.\//,              // Path traversal
    /\\x[0-9a-f]{2}/i,     // Hex escapes
    /<\?xml/i,             // XML content
    /<!DOCTYPE/i,          // DOCTYPE declarations
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      throw new Error(`Invalid ${type} content`);
    }
  }
  
  // Check base64 content is valid
  const base64Content = content
    .replace(/-----[^-]+-----/g, '')
    .replace(/[\r\n\s]/g, '');
  
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64Content)) {
    throw new Error(`Invalid base64 in ${type}`);
  }
  
  return true;
};

// Configure multer with strict security
const upload = multer({
  dest: path.join(__dirname, '../../../.temp/'),
  limits: {
    fileSize: 500 * 1024, // 500KB max (certificates are tiny)
    files: 3,
    fields: 5,
    parts: 10, // Limit total parts
  },
  fileFilter: async (req, file, cb) => {
    // Validate filename strictly
    if (!/^[a-zA-Z0-9_-]+\.(pem|crt|key|cer)$/i.test(file.originalname)) {
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
    const certPath = await sanitizePath('cert.pem');
    const keyPath = await sanitizePath('key.pem');
    
    const status = {
      hasCertificate: false,
      hasPrivateKey: false,
      expiryDate: null,
      daysUntilExpiry: null,
      issuer: null,
      subject: null,
      isValid: false,
      isSelfSigned: false,
    };

    // Atomic file checks
    const [certExists, keyExists] = await Promise.all([
      fs.access(certPath).then(() => true).catch(() => false),
      fs.access(keyPath).then(() => true).catch(() => false)
    ]);
    
    status.hasCertificate = certExists;
    status.hasPrivateKey = keyExists;

    // Get certificate details if it exists
    if (status.hasCertificate) {
      try {
        // Use spawn to safely get certificate info
        const [enddate, issuer, subject, fingerprint] = await Promise.all([
          execCommand('openssl', ['x509', '-in', certPath, '-noout', '-enddate']),
          execCommand('openssl', ['x509', '-in', certPath, '-noout', '-issuer']),
          execCommand('openssl', ['x509', '-in', certPath, '-noout', '-subject']),
          execCommand('openssl', ['x509', '-in', certPath, '-noout', '-fingerprint', '-sha256'])
        ]);
        
        const expiryDate = new Date(enddate.replace('notAfter=', '').trim());
        status.expiryDate = expiryDate.toISOString();
        status.daysUntilExpiry = Math.floor((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
        status.issuer = issuer.replace('issuer=', '').trim();
        status.subject = subject.replace('subject=', '').trim();
        status.fingerprint = fingerprint.replace(/.*=/, '').trim();
        status.isSelfSigned = status.issuer === status.subject;
        status.isValid = status.daysUntilExpiry > 0;
        
      } catch (error) {
        // Don't expose internal errors
        status.error = 'Failed to parse certificate';
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
  certRateLimit,
  upload.fields([
    { name: 'certificate', maxCount: 1 },
    { name: 'privateKey', maxCount: 1 },
    { name: 'chain', maxCount: 1 }
  ]),
  async (req, res) => {
    let tempFiles = [];
    let lockId = null;
    
    try {
      // Acquire lock for certificate operations
      lockId = await acquireLock('certificates');
      
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
      
      // Validate certificate security
      await validateCertificateSecurity(certFile.path);
      
      // Validate certificate using OpenSSL
      await execCommand('openssl', ['x509', '-in', certFile.path, '-noout']);
      
      // Validate private key
      try {
        await execCommand('openssl', ['rsa', '-in', keyFile.path, '-check', '-noout']);
      } catch (rsaError) {
        try {
          await execCommand('openssl', ['ec', '-in', keyFile.path, '-check', '-noout']);
        } catch (ecError) {
          throw new Error('Invalid private key');
        }
      }

      // Verify certificate and key match using public key comparison
      const certPubKey = await execCommand('openssl', ['x509', '-in', certFile.path, '-noout', '-pubkey']);
      const keyPubKey = await execCommand('openssl', ['rsa', '-in', keyFile.path, '-pubout'])
        .catch(() => execCommand('openssl', ['ec', '-in', keyFile.path, '-pubout']));
      
      // Use constant-time comparison
      if (!crypto.timingSafeEqual(Buffer.from(certPubKey), Buffer.from(keyPubKey))) {
        throw new Error('Certificate and key do not match');
      }

      // Create secure backup with random name
      const certsDir = path.resolve(__dirname, '../../../certs');
      const backupId = crypto.randomBytes(16).toString('hex').replace(/[^a-f0-9]/gi, '');
      // Validate backup ID is safe
      if (!/^[a-f0-9]{32}$/i.test(backupId)) {
        throw new Error('Invalid backup ID generated');
      }
      const backupDir = path.join(certsDir, 'backup', backupId);
      // Ensure backup directory is within certs
      const realCertsDir = await fs.realpath(certsDir).catch(() => certsDir);
      if (!backupDir.startsWith(realCertsDir) && !backupDir.startsWith(certsDir)) {
        throw new Error('Invalid backup directory');
      }
      await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });

      // Backup existing certificates
      try {
        const existingCert = await sanitizePath('cert.pem');
        const existingKey = await sanitizePath('key.pem');
        await Promise.all([
          fs.copyFile(existingCert, path.join(backupDir, 'cert.pem')),
          fs.copyFile(existingKey, path.join(backupDir, 'key.pem'))
        ]);
      } catch (e) {
        // No existing certificates to backup
      }

      // Write new certificates atomically
      const newCertPath = await sanitizePath('cert.pem');
      const newKeyPath = await sanitizePath('key.pem');
      
      // Write to temp files first
      const tempCertPath = `${newCertPath}.tmp`;
      const tempKeyPath = `${newKeyPath}.tmp`;
      
      await fs.writeFile(tempCertPath, certContent, { mode: 0o644 });
      await fs.writeFile(tempKeyPath, keyContent, { mode: 0o600 });
      
      // Atomic rename
      await Promise.all([
        fs.rename(tempCertPath, newCertPath),
        fs.rename(tempKeyPath, newKeyPath)
      ]);
      
      if (chainFile) {
        const chainContent = await fs.readFile(chainFile.path, 'utf8');
        validatePEMContent(chainContent, 'CERTIFICATE');
        const newChainPath = await sanitizePath('chain.pem');
        const tempChainPath = `${newChainPath}.tmp`;
        await fs.writeFile(tempChainPath, chainContent, { mode: 0o644 });
        await fs.rename(tempChainPath, newChainPath);
      }
      
      // Clean old backups
      await cleanOldBackups();

      res.json({ 
        success: true, 
        message: 'Certificates uploaded successfully' 
      });

    } catch (error) {
      res.status(400).json({ error: 'Upload failed' });
    } finally {
      // Release lock
      if (lockId) {
        releaseLock('certificates', lockId);
      }
      
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
router.post('/generate-self-signed', 
  authenticate, 
  authorize('admin'),
  certRateLimit,
  async (req, res) => {
    let lockId = null;
    
    try {
      lockId = await acquireLock('certificates');
      
      const { commonName, country, state, locality, organization, days } = req.body;
      
      // Input validation with strict regex
      if (!commonName || typeof commonName !== 'string') {
        return res.status(400).json({ error: 'Common Name is required' });
      }
      
      // Very strict sanitization
      const sanitize = (input, maxLen = 64) => {
        if (!input) return '';
        return String(input)
          .substring(0, maxLen)
          .replace(/[^a-zA-Z0-9 .\-]/g, '');
      };
      
      const sanitizedCN = sanitize(commonName);
      if (!sanitizedCN || sanitizedCN.length < 3 || sanitizedCN.length > 64) {
        return res.status(400).json({ error: 'Invalid Common Name' });
      }
      
      // Validate domain-like CN
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(sanitizedCN)) {
        return res.status(400).json({ error: 'Invalid Common Name format' });
      }
      
      const sanitizedCountry = country ? sanitize(country, 2).toUpperCase() : '';
      const sanitizedState = sanitize(state);
      const sanitizedLocality = sanitize(locality);
      const sanitizedOrg = sanitize(organization);
      const validDays = Math.min(Math.max(parseInt(days) || 365, 1), 825); // Max 825 days per CA/B Forum

      // Create backup
      const certsDir = path.resolve(__dirname, '../../../certs');
      const backupId = crypto.randomBytes(16).toString('hex').replace(/[^a-f0-9]/gi, '');
      // Validate backup ID is safe
      if (!/^[a-f0-9]{32}$/i.test(backupId)) {
        throw new Error('Invalid backup ID generated');
      }
      const backupDir = path.join(certsDir, 'backup', backupId);
      // Ensure backup directory is within certs
      const realCertsDir = await fs.realpath(certsDir).catch(() => certsDir);
      if (!backupDir.startsWith(realCertsDir) && !backupDir.startsWith(certsDir)) {
        throw new Error('Invalid backup directory');
      }
      await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });

      // Backup existing
      try {
        await Promise.all([
          fs.copyFile(await sanitizePath('cert.pem'), path.join(backupDir, 'cert.pem')),
          fs.copyFile(await sanitizePath('key.pem'), path.join(backupDir, 'key.pem'))
        ]);
      } catch (e) {
        // No existing certificates
      }

      // Generate certificate
      const certPath = await sanitizePath('cert.pem');
      const keyPath = await sanitizePath('key.pem');
      const tempCertPath = `${certPath}.tmp`;
      const tempKeyPath = `${keyPath}.tmp`;
      
      // Build subject safely
      const subjectComponents = [];
      if (sanitizedCountry && /^[A-Z]{2}$/.test(sanitizedCountry)) {
        subjectComponents.push(`C=${sanitizedCountry}`);
      }
      if (sanitizedState) subjectComponents.push(`ST=${sanitizedState}`);
      if (sanitizedLocality) subjectComponents.push(`L=${sanitizedLocality}`);
      if (sanitizedOrg) subjectComponents.push(`O=${sanitizedOrg}`);
      subjectComponents.push(`CN=${sanitizedCN}`);
      
      const subject = `/${subjectComponents.join('/')}`;
      
      // Generate with strong key
      await execCommand('openssl', [
        'req',
        '-x509',
        '-newkey', 'rsa:4096',
        '-keyout', tempKeyPath,
        '-out', tempCertPath,
        '-days', String(validDays),
        '-nodes',
        '-sha256', // Force SHA256
        '-subj', subject
      ]);

      // Set permissions and move atomically
      await fs.chmod(tempKeyPath, 0o600);
      await fs.chmod(tempCertPath, 0o644);
      
      await Promise.all([
        fs.rename(tempCertPath, certPath),
        fs.rename(tempKeyPath, keyPath)
      ]);
      
      // Clean old backups
      await cleanOldBackups();

      res.json({ 
        success: true, 
        message: 'Certificate generated successfully' 
      });

    } catch (error) {
      res.status(500).json({ error: 'Generation failed' });
    } finally {
      if (lockId) {
        releaseLock('certificates', lockId);
      }
    }
  }
);

// Test TLS configuration with SSRF protection
router.post('/test', 
  authenticate, 
  authorize('admin'),
  rateLimit({
    windowMs: 60 * 1000,
    max: 10
  }),
  async (req, res) => {
    try {
      const { hostname, port } = req.body;
      
      // Strict input validation
      const testPort = Math.min(Math.max(parseInt(port) || 443, 1), 65535);
      
      // SSRF Protection: Block internal IPs and metadata endpoints
      const blockedPatterns = [
        /^127\./,          // Localhost
        /^10\./,           // Private network
        /^172\.(1[6-9]|2[0-9]|3[01])\./,  // Private network
        /^192\.168\./,     // Private network
        /^169\.254\./,     // Link-local
        /^0\./,            // Invalid
        /^224\./,          // Multicast
        /^::/,             // IPv6 localhost
        /^fe80:/i,         // IPv6 link-local
        /metadata/i,       // Cloud metadata endpoints
        /localhost/i,      // Localhost names
      ];
      
      const testHost = String(hostname || '').trim();
      
      for (const pattern of blockedPatterns) {
        if (pattern.test(testHost)) {
          return res.status(400).json({ error: 'Invalid hostname' });
        }
      }
      
      // Only allow FQDN or public IPs
      if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(testHost) &&
          !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(testHost)) {
        return res.status(400).json({ error: 'Invalid hostname format' });
      }

      // Test with timeout and size limits
      const result = await execCommand('timeout', [
        '3',
        'openssl',
        's_client',
        '-connect', `${testHost}:${testPort}`,
        '-servername', testHost,
        '-brief'
      ], { timeout: 4000 });
      
      res.json({
        success: true,
        message: 'Connection test completed',
        summary: result.substring(0, 200) // Very limited output
      });
      
    } catch (error) {
      res.json({
        success: false,
        message: 'Connection test failed'
      });
    }
  }
);

// Download certificate for backup
router.get('/download/:type', 
  authenticate, 
  authorize('admin'),
  rateLimit({
    windowMs: 60 * 1000,
    max: 10
  }),
  async (req, res) => {
    try {
      const { type } = req.params;
      
      if (!['certificate', 'chain'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }

      const filename = type === 'certificate' ? 'cert.pem' : 'chain.pem';
      const filepath = await sanitizePath(filename);

      // Atomic read
      const content = await fs.readFile(filepath, 'utf8');
      
      // Validate it's actually a certificate
      validatePEMContent(content, 'CERTIFICATE');

      // Security headers
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');

      res.send(content);

    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.status(500).json({ error: 'Download failed' });
      }
    }
  }
);

module.exports = router;