const crypto = require('crypto');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

class SecurityService {
  constructor() {
    this.loginAttempts = new Map();
    this.suspiciousPatterns = new Map();
  }

  /**
   * Generate comprehensive device fingerprint
   */
  generateDeviceFingerprint(req, clientData = {}) {
    const parser = new UAParser(req.headers['user-agent']);
    const ua = parser.getResult();
    
    const fingerprint = {
      // Browser/Device info
      browser: `${ua.browser.name || 'unknown'} ${ua.browser.version || ''}`.trim(),
      os: `${ua.os.name || 'unknown'} ${ua.os.version || ''}`.trim(),
      device: ua.device.model || ua.device.type || 'desktop',
      
      // Network info
      ip: req.ip?.replace(/^::ffff:/, '') || 'unknown',
      
      // Headers fingerprint
      headers: {
        acceptLanguage: req.headers['accept-language'] || '',
        acceptEncoding: req.headers['accept-encoding'] || '',
        doNotTrack: req.headers['dnt'] || '',
      },
      
      // Client-side data (if provided)
      screen: clientData.screen || null,
      timezone: clientData.timezone || null,
      canvas: clientData.canvas || null,
      webgl: clientData.webgl || null,
      fonts: clientData.fonts || null,
      
      // Timestamp
      timestamp: Date.now()
    };
    
    // Generate hash
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        browser: fingerprint.browser,
        os: fingerprint.os,
        device: fingerprint.device,
        headers: fingerprint.headers,
        screen: fingerprint.screen,
        timezone: fingerprint.timezone
      }))
      .digest('hex');
    
    return {
      ...fingerprint,
      hash,
      trustScore: this.calculateTrustScore(fingerprint)
    };
  }

  /**
   * Calculate trust score for device
   */
  calculateTrustScore(fingerprint) {
    let score = 1.0;
    
    // Reduce score for suspicious factors
    if (!fingerprint.headers.acceptLanguage) score -= 0.1;
    if (!fingerprint.headers.acceptEncoding) score -= 0.1;
    if (fingerprint.device === 'unknown') score -= 0.15;
    if (fingerprint.browser.includes('unknown')) score -= 0.15;
    
    // VPN/Proxy detection (basic)
    if (this.isVpnOrProxy(fingerprint.ip)) score -= 0.3;
    
    // Tor detection
    if (this.isTorExit(fingerprint.ip)) score -= 0.5;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Detect anomalies in login attempt
   */
  async detectAnomalies(user, request, fingerprint) {
    const anomalies = [];
    const riskFactors = [];
    
    // 1. Impossible travel detection
    if (user.lastLogin) {
      const travelAnomaly = this.detectImpossibleTravel(
        user.lastLogin,
        {
          ip: request.ip,
          timestamp: Date.now()
        }
      );
      
      if (travelAnomaly.impossible) {
        anomalies.push({
          type: 'IMPOSSIBLE_TRAVEL',
          severity: 'HIGH',
          details: travelAnomaly
        });
        riskFactors.push(0.4);
      }
    }
    
    // 2. New device detection
    if (user.knownDevices && !user.knownDevices.includes(fingerprint.hash)) {
      anomalies.push({
        type: 'NEW_DEVICE',
        severity: 'MEDIUM',
        details: { device: fingerprint.device, browser: fingerprint.browser }
      });
      riskFactors.push(0.2);
    }
    
    // 3. Unusual time detection
    const hourOfDay = new Date().getHours();
    if (user.normalLoginHours) {
      const isUnusualTime = !user.normalLoginHours.includes(hourOfDay);
      if (isUnusualTime) {
        anomalies.push({
          type: 'UNUSUAL_TIME',
          severity: 'LOW',
          details: { hour: hourOfDay, normal: user.normalLoginHours }
        });
        riskFactors.push(0.1);
      }
    }
    
    // 4. Suspicious IP patterns
    const ipRisk = await this.checkIPReputation(request.ip);
    if (ipRisk.suspicious) {
      anomalies.push({
        type: 'SUSPICIOUS_IP',
        severity: ipRisk.severity,
        details: ipRisk
      });
      riskFactors.push(ipRisk.riskScore);
    }
    
    // 5. Brute force pattern
    const bruteForce = this.detectBruteForce(request.ip, user.username);
    if (bruteForce.detected) {
      anomalies.push({
        type: 'BRUTE_FORCE_PATTERN',
        severity: 'HIGH',
        details: bruteForce
      });
      riskFactors.push(0.5);
    }
    
    // Calculate overall risk score
    const riskScore = Math.min(1, riskFactors.reduce((a, b) => a + b, 0));
    
    return {
      anomalies,
      riskScore,
      requiresMFA: riskScore > 0.3,
      shouldBlock: riskScore > 0.7,
      requiresCaptcha: riskScore > 0.5
    };
  }

  /**
   * Detect impossible travel between logins
   */
  detectImpossibleTravel(lastLogin, currentLogin) {
    const timeDiff = (currentLogin.timestamp - lastLogin.timestamp) / 1000 / 60; // minutes
    
    // Get geographic locations
    const lastGeo = geoip.lookup(lastLogin.ip);
    const currentGeo = geoip.lookup(currentLogin.ip);
    
    if (!lastGeo || !currentGeo) {
      return { impossible: false, reason: 'Unable to determine location' };
    }
    
    // Calculate distance
    const distance = this.calculateDistance(
      lastGeo.ll[0], lastGeo.ll[1],
      currentGeo.ll[0], currentGeo.ll[1]
    );
    
    // Maximum realistic travel speed (km/h)
    const maxSpeed = 900; // Commercial flight speed
    const possibleDistance = (maxSpeed * timeDiff) / 60;
    
    if (distance > possibleDistance) {
      return {
        impossible: true,
        distance: Math.round(distance),
        timeDiff: Math.round(timeDiff),
        lastLocation: `${lastGeo.city}, ${lastGeo.country}`,
        currentLocation: `${currentGeo.city}, ${currentGeo.country}`,
        message: `Login from ${currentGeo.city} only ${timeDiff} minutes after ${lastGeo.city} (${distance}km apart)`
      };
    }
    
    return { impossible: false };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI/180);
  }

  /**
   * Check IP reputation
   */
  async checkIPReputation(ip) {
    const normalized = ip.replace(/^::ffff:/, '');
    
    // Check against known bad IPs (in production, use external service)
    const badIPs = [
      // Add known malicious IPs here
    ];
    
    if (badIPs.includes(normalized)) {
      return {
        suspicious: true,
        severity: 'HIGH',
        riskScore: 0.8,
        reason: 'Known malicious IP'
      };
    }
    
    // Check if it's a VPN/Proxy
    if (this.isVpnOrProxy(normalized)) {
      return {
        suspicious: true,
        severity: 'MEDIUM',
        riskScore: 0.3,
        reason: 'VPN/Proxy detected'
      };
    }
    
    // Check if it's Tor
    if (this.isTorExit(normalized)) {
      return {
        suspicious: true,
        severity: 'HIGH',
        riskScore: 0.6,
        reason: 'Tor exit node'
      };
    }
    
    return { suspicious: false, riskScore: 0 };
  }

  /**
   * Basic VPN/Proxy detection
   */
  isVpnOrProxy(ip) {
    // In production, use services like IPQualityScore or MaxMind
    const vpnRanges = [
      '10.0.0.0/8',     // Private
      '172.16.0.0/12',  // Private
      '192.168.0.0/16', // Private
      // Add known VPN provider ranges
    ];
    
    // This is simplified - use proper IP range checking
    return false;
  }

  /**
   * Check if IP is Tor exit node
   */
  isTorExit(ip) {
    // In production, check against Tor exit node list
    // https://check.torproject.org/cgi-bin/TorBulkExitList.py
    return false;
  }

  /**
   * Detect brute force patterns
   */
  detectBruteForce(ip, username) {
    const key = `${ip}:${username}`;
    const now = Date.now();
    const window = 5 * 60 * 1000; // 5 minutes
    
    if (!this.loginAttempts.has(key)) {
      this.loginAttempts.set(key, []);
    }
    
    const attempts = this.loginAttempts.get(key);
    
    // Add current attempt
    attempts.push(now);
    
    // Clean old attempts
    const recentAttempts = attempts.filter(t => now - t < window);
    this.loginAttempts.set(key, recentAttempts);
    
    // Check for patterns
    if (recentAttempts.length > 5) {
      // Check timing patterns
      const intervals = [];
      for (let i = 1; i < recentAttempts.length; i++) {
        intervals.push(recentAttempts[i] - recentAttempts[i-1]);
      }
      
      // Automated attacks often have regular intervals
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      // Low standard deviation = automated
      const isAutomated = stdDev < 1000; // Less than 1 second variation
      
      return {
        detected: true,
        attempts: recentAttempts.length,
        automated: isAutomated,
        pattern: isAutomated ? 'AUTOMATED' : 'MANUAL'
      };
    }
    
    return { detected: false };
  }

  /**
   * Exponential backoff for account lockout
   */
  calculateLockoutDuration(failedAttempts) {
    if (failedAttempts < 3) return 0;
    if (failedAttempts === 3) return 60 * 1000; // 1 minute
    if (failedAttempts === 4) return 5 * 60 * 1000; // 5 minutes
    if (failedAttempts === 5) return 15 * 60 * 1000; // 15 minutes
    if (failedAttempts === 6) return 60 * 60 * 1000; // 1 hour
    return 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Generate backup codes for MFA
   */
  generateBackupCodes(count = 10) {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formatted = `${code.substr(0, 4)}-${code.substr(4, 4)}`;
      
      codes.push({
        code: formatted,
        hash: crypto.createHash('sha256').update(formatted).digest('hex'),
        used: false,
        createdAt: Date.now()
      });
    }
    
    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(inputCode, storedCodes) {
    const normalized = inputCode.replace(/[^A-Z0-9]/g, '').toUpperCase();
    const formatted = `${normalized.substr(0, 4)}-${normalized.substr(4, 4)}`;
    const inputHash = crypto.createHash('sha256').update(formatted).digest('hex');
    
    for (const stored of storedCodes) {
      if (!stored.used && crypto.timingSafeEqual(
        Buffer.from(stored.hash),
        Buffer.from(inputHash)
      )) {
        stored.used = true;
        stored.usedAt = Date.now();
        return true;
      }
    }
    
    return false;
  }
}

module.exports = new SecurityService();