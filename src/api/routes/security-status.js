const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { requireConfigure } = require('../middleware/rbac');

/**
 * Get comprehensive security status
 */
router.get('/status', authenticate, requireConfigure, async (req, res) => {
  try {
    const securityStatus = {
      overall: 'good', // will be calculated
      score: 100,
      critical: {
        secrets: {
          status: 'configured',
          items: []
        },
        authentication: {
          status: 'configured',
          items: []
        }
      },
      network: {
        tls: {
          status: 'not_configured',
          items: []
        },
        proxy: {
          status: 'not_configured',
          items: []
        }
      },
      optional: {
        mfa: {
          status: 'not_configured',
          items: []
        },
        webauthn: {
          status: 'not_configured',
          items: []
        },
        authentication: {
          status: 'configured',
          items: []
        }
      },
      recommendations: []
    };

    // Check critical secrets
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
      securityStatus.critical.secrets.items.push({
        name: 'JWT Secret',
        status: 'configured',
        icon: 'check'
      });
    } else {
      securityStatus.critical.secrets.status = 'error';
      securityStatus.critical.secrets.items.push({
        name: 'JWT Secret',
        status: 'missing',
        icon: 'error'
      });
      securityStatus.score -= 25;
    }

    if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length >= 32) {
      securityStatus.critical.secrets.items.push({
        name: 'JWT Refresh Secret',
        status: 'configured',
        icon: 'check'
      });
    } else {
      securityStatus.critical.secrets.status = 'error';
      securityStatus.critical.secrets.items.push({
        name: 'JWT Refresh Secret',
        status: 'missing',
        icon: 'error'
      });
      securityStatus.score -= 25;
    }

    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
      securityStatus.critical.secrets.items.push({
        name: 'Session Secret',
        status: 'configured',
        icon: 'check'
      });
    } else {
      securityStatus.critical.secrets.status = 'error';
      securityStatus.critical.secrets.items.push({
        name: 'Session Secret',
        status: 'missing',
        icon: 'error'
      });
      securityStatus.score -= 25;
    }

    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32) {
      securityStatus.critical.secrets.items.push({
        name: 'Encryption Key',
        status: 'configured',
        icon: 'check'
      });
    } else {
      securityStatus.critical.secrets.items.push({
        name: 'Encryption Key',
        status: 'missing',
        icon: 'warning'
      });
      securityStatus.score -= 10;
    }

    // Check authentication
    const usersPath = path.join(process.cwd(), 'users.json');
    try {
      const usersData = await fs.readFile(usersPath, 'utf8');
      const users = JSON.parse(usersData);
      const adminCount = users.filter(u => u.role === 'admin').length;
      
      securityStatus.critical.authentication.items.push({
        name: 'Admin Users',
        status: 'configured',
        value: `${adminCount} admin(s)`,
        icon: 'check'
      });

      // Check for default passwords
      const hasDefaultPasswords = users.some(u => 
        u.passwordHash && (
          u.passwordHash.includes('Admin123') || 
          u.passwordHash.includes('Help123')
        )
      );

      if (hasDefaultPasswords) {
        securityStatus.critical.authentication.status = 'warning';
        securityStatus.critical.authentication.items.push({
          name: 'Default Passwords',
          status: 'found',
          icon: 'warning'
        });
        securityStatus.recommendations.push('Change default passwords immediately');
        securityStatus.score -= 15;
      }
    } catch (err) {
      securityStatus.critical.authentication.status = 'warning';
      securityStatus.critical.authentication.items.push({
        name: 'User Database',
        status: 'not_initialized',
        icon: 'warning'
      });
    }

    // Check TLS/HTTPS
    if (process.env.BEHIND_PROXY === 'true') {
      securityStatus.network.proxy.status = 'configured';
      securityStatus.network.proxy.items.push({
        name: 'Reverse Proxy',
        status: 'enabled',
        icon: 'check'
      });

      if (process.env.TRUSTED_PROXIES) {
        securityStatus.network.proxy.items.push({
          name: 'Trusted Proxies',
          status: 'configured',
          value: process.env.TRUSTED_PROXIES,
          icon: 'check'
        });
      } else {
        securityStatus.network.proxy.items.push({
          name: 'Trusted Proxies',
          status: 'not_configured',
          icon: 'warning'
        });
        securityStatus.recommendations.push('Configure TRUSTED_PROXIES for security');
      }
    }

    if (process.env.TLS_CERT_PATH && process.env.TLS_KEY_PATH) {
      try {
        await fs.access(process.env.TLS_CERT_PATH);
        await fs.access(process.env.TLS_KEY_PATH);
        
        securityStatus.network.tls.status = 'configured';
        securityStatus.network.tls.items.push({
          name: 'TLS Certificate',
          status: 'configured',
          icon: 'check'
        });
      } catch (err) {
        securityStatus.network.tls.status = 'error';
        securityStatus.network.tls.items.push({
          name: 'TLS Certificate',
          status: 'files_missing',
          icon: 'error'
        });
      }
    } else if (process.env.BEHIND_PROXY !== 'true') {
      securityStatus.network.tls.items.push({
        name: 'TLS Certificate',
        status: 'not_configured',
        icon: 'warning'
      });
      securityStatus.recommendations.push('Configure TLS certificates or use a reverse proxy');
    }

    // Check MFA
    const mfaPath = path.join(process.cwd(), 'data', 'mfa.json');
    try {
      const mfaData = await fs.readFile(mfaPath, 'utf8');
      const mfa = JSON.parse(mfaData);
      const mfaUsers = Object.keys(mfa).length;
      
      if (mfaUsers > 0) {
        securityStatus.optional.mfa.status = 'configured';
        securityStatus.optional.mfa.items.push({
          name: 'MFA Users',
          status: 'configured',
          value: `${mfaUsers} user(s)`,
          icon: 'check'
        });
      }
    } catch (err) {
      securityStatus.optional.mfa.items.push({
        name: 'Multi-Factor Auth',
        status: 'not_enabled',
        icon: 'info'
      });
    }

    // Check WebAuthn
    if (process.env.RP_ID && process.env.RP_ID !== 'localhost') {
      securityStatus.optional.webauthn.status = 'configured';
      securityStatus.optional.webauthn.items.push({
        name: 'WebAuthn/FIDO2',
        status: 'configured',
        value: process.env.RP_ID,
        icon: 'check'
      });
    } else {
      securityStatus.optional.webauthn.items.push({
        name: 'WebAuthn/FIDO2',
        status: 'not_configured',
        icon: 'info'
      });
    }

    // Check Authentication Features
    // Session timeout
    const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 1800000;
    securityStatus.optional.authentication.items.push({
      name: 'Session Timeout',
      status: 'configured',
      value: `${sessionTimeout / 60000} minutes`,
      icon: 'check'
    });

    // Password policy
    const minPasswordLength = parseInt(process.env.PASSWORD_MIN_LENGTH) || 8;
    securityStatus.optional.authentication.items.push({
      name: 'Password Policy',
      status: minPasswordLength >= 12 ? 'strong' : 'moderate',
      value: `Min ${minPasswordLength} chars`,
      icon: minPasswordLength >= 12 ? 'check' : 'warning'
    });

    // Account lockout
    const maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockoutDuration = parseInt(process.env.LOCKOUT_DURATION) || 1800000;
    securityStatus.optional.authentication.items.push({
      name: 'Account Lockout',
      status: 'configured',
      value: `${maxLoginAttempts} attempts, ${lockoutDuration / 60000}min lock`,
      icon: 'check'
    });

    // Check if OAuth2/SSO is configured
    if (process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID) {
      securityStatus.optional.authentication.items.push({
        name: 'Azure AD SSO',
        status: 'configured',
        value: 'Enabled',
        icon: 'check'
      });
      securityStatus.optional.authentication.status = 'configured';
    }

    // Check if LDAP is configured (if you have LDAP support)
    if (process.env.LDAP_URL) {
      securityStatus.optional.authentication.items.push({
        name: 'LDAP Integration',
        status: 'configured',
        value: 'Enabled',
        icon: 'check'
      });
    }

    // Check IP Whitelist
    const whitelistPath = path.join(process.cwd(), 'ip-whitelist.json');
    try {
      const whitelistData = await fs.readFile(whitelistPath, 'utf8');
      const whitelist = JSON.parse(whitelistData);
      
      if (whitelist.enabled) {
        securityStatus.network.proxy.items.push({
          name: 'IP Whitelist',
          status: 'enabled',
          value: `${whitelist.addresses?.length || 0} IPs`,
          icon: 'check'
        });
      }
    } catch (err) {
      // IP whitelist not configured
    }

    // Calculate overall status
    if (securityStatus.score >= 90) {
      securityStatus.overall = 'excellent';
    } else if (securityStatus.score >= 75) {
      securityStatus.overall = 'good';
    } else if (securityStatus.score >= 60) {
      securityStatus.overall = 'fair';
    } else {
      securityStatus.overall = 'needs_attention';
    }

    // Add general recommendations
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.BEHIND_PROXY && !process.env.TLS_CERT_PATH) {
        securityStatus.recommendations.push('Enable HTTPS with TLS certificates or use a reverse proxy');
      }
      if (securityStatus.optional.mfa.status !== 'configured') {
        securityStatus.recommendations.push('Enable MFA for admin accounts');
      }
      if (process.env.DEBUG === 'true') {
        securityStatus.recommendations.push('Disable DEBUG mode in production');
        securityStatus.score -= 10;
      }
    }

    res.json(securityStatus);
  } catch (error) {
    console.error('Error getting security status:', error);
    res.status(500).json({ error: 'Failed to get security status' });
  }
});

/**
 * Generate new security secrets
 */
router.post('/generate-secrets', authenticate, requireConfigure, async (req, res) => {
  try {
    const secrets = {
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
      SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
      ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex')
    };

    // Save to .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (err) {
      // .env file doesn't exist, create new one
      envContent = '';
    }

    // Update or add secrets
    for (const [key, value] of Object.entries(secrets)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    // Add timestamp
    envContent += `\n# Secrets generated on ${new Date().toISOString()}\n`;

    await fs.writeFile(envPath, envContent);

    res.json({
      success: true,
      message: 'Security secrets generated successfully',
      warning: 'Server restart required for changes to take effect'
    });
  } catch (error) {
    console.error('Error generating secrets:', error);
    res.status(500).json({ error: 'Failed to generate secrets' });
  }
});

/**
 * Get security recommendations
 */
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const recommendations = [];
    const isProduction = process.env.NODE_ENV === 'production';

    // Check environment
    if (isProduction) {
      recommendations.push({
        category: 'Environment',
        priority: 'high',
        items: [
          {
            title: 'Use HTTPS',
            description: 'Always use HTTPS in production with valid SSL certificates',
            status: process.env.FORCE_HTTPS === 'true' ? 'completed' : 'pending'
          },
          {
            title: 'Disable Debug Mode',
            description: 'Ensure DEBUG is set to false in production',
            status: process.env.DEBUG !== 'true' ? 'completed' : 'pending'
          }
        ]
      });
    }

    // Authentication recommendations
    recommendations.push({
      category: 'Authentication',
      priority: 'high',
      items: [
        {
          title: 'Enable MFA',
          description: 'Enable multi-factor authentication for all admin accounts',
          status: 'recommended'
        },
        {
          title: 'Strong Password Policy',
          description: 'Enforce minimum 12 character passwords with complexity requirements',
          status: 'recommended'
        },
        {
          title: 'Regular Password Rotation',
          description: 'Require password changes every 90 days',
          status: 'optional'
        }
      ]
    });

    // Network security
    recommendations.push({
      category: 'Network Security',
      priority: 'medium',
      items: [
        {
          title: 'IP Whitelisting',
          description: 'Restrict access to known IP addresses where possible',
          status: 'recommended'
        },
        {
          title: 'Rate Limiting',
          description: 'Implement rate limiting on API endpoints',
          status: 'implemented'
        },
        {
          title: 'DDoS Protection',
          description: 'Use a CDN or DDoS protection service',
          status: 'optional'
        }
      ]
    });

    // Data protection
    recommendations.push({
      category: 'Data Protection',
      priority: 'medium',
      items: [
        {
          title: 'Encrypt Sensitive Data',
          description: 'Ensure all sensitive data is encrypted at rest',
          status: process.env.ENCRYPTION_KEY ? 'completed' : 'pending'
        },
        {
          title: 'Regular Backups',
          description: 'Implement automated backups of configuration and data',
          status: 'recommended'
        },
        {
          title: 'Audit Logging',
          description: 'Enable comprehensive audit logging for all admin actions',
          status: 'recommended'
        }
      ]
    });

    res.json(recommendations);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

module.exports = router;