const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');

// Redis client for token management
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// Token families for tracking refresh token chains
const tokenFamilies = new Map();

class TokenService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET;
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    this.ACCESS_TOKEN_EXPIRY = '15m';
    this.REFRESH_TOKEN_EXPIRY = '7d';
  }

  /**
   * Generate token family ID for tracking refresh chains
   */
  generateFamilyId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate device fingerprint from request
   */
  generateFingerprint(req) {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.ip || ''
    ];
    
    // Create hash of components
    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Generate new token pair with rotation tracking
   */
  async generateTokenPair(user, req, familyId = null) {
    // Generate or use existing family ID
    const tokenFamily = familyId || this.generateFamilyId();
    const fingerprint = this.generateFingerprint(req);
    const jti = crypto.randomBytes(16).toString('hex'); // Unique token ID
    
    // Access token payload
    const accessPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions || [],
      fingerprint, // Device fingerprint for validation
      type: 'access'
    };

    // Refresh token payload with family tracking
    const refreshPayload = {
      userId: user.id,
      username: user.username,
      familyId: tokenFamily,
      fingerprint,
      jti, // Unique identifier for this specific token
      type: 'refresh'
    };

    // Generate tokens
    const accessToken = jwt.sign(accessPayload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'smtp-relay',
      audience: 'smtp-relay-api'
    });

    const refreshToken = jwt.sign(refreshPayload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'smtp-relay',
      audience: 'smtp-relay-api'
    });

    // Store refresh token metadata in Redis
    await this.storeRefreshToken(refreshToken, {
      userId: user.id,
      familyId: tokenFamily,
      fingerprint,
      jti,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    // Track token family
    await this.trackTokenFamily(tokenFamily, user.id, jti);

    return {
      accessToken,
      refreshToken,
      familyId: tokenFamily,
      fingerprint
    };
  }

  /**
   * Rotate refresh token - CRITICAL SECURITY FEATURE
   */
  async rotateRefreshToken(oldRefreshToken, req) {
    try {
      // Decode old token
      const decoded = jwt.verify(oldRefreshToken, this.JWT_REFRESH_SECRET);
      
      // Check if token was already used (REPLAY ATTACK DETECTION)
      const isUsed = await this.isTokenUsed(decoded.jti);
      if (isUsed) {
        // SECURITY ALERT: Token reuse detected!
        console.error(`🚨 SECURITY ALERT: Refresh token reuse detected for user ${decoded.userId}`);
        
        // Invalidate entire token family
        await this.invalidateTokenFamily(decoded.familyId);
        
        // Log security event
        await this.logSecurityEvent({
          type: 'REFRESH_TOKEN_REUSE',
          userId: decoded.userId,
          familyId: decoded.familyId,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        throw new Error('Token reuse detected - all tokens invalidated');
      }

      // Verify fingerprint matches
      const currentFingerprint = this.generateFingerprint(req);
      if (decoded.fingerprint !== currentFingerprint) {
        // Device changed - could be legitimate or attack
        await this.logSecurityEvent({
          type: 'DEVICE_FINGERPRINT_MISMATCH',
          userId: decoded.userId,
          expected: decoded.fingerprint,
          received: currentFingerprint
        });
        
        // Require re-authentication for safety
        throw new Error('Device fingerprint mismatch');
      }

      // Mark old token as used
      await this.markTokenAsUsed(decoded.jti);

      // Get user data
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token pair with same family ID
      const newTokens = await this.generateTokenPair(user, req, decoded.familyId);

      // Blacklist old refresh token
      await this.blacklistToken(oldRefreshToken);

      return newTokens;
    } catch (error) {
      // Any error in rotation = force re-login for security
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      throw error;
    }
  }

  /**
   * Store refresh token metadata in Redis
   */
  async storeRefreshToken(token, metadata) {
    const key = `refresh_token:${metadata.jti}`;
    const ttl = 7 * 24 * 60 * 60; // 7 days
    
    await redis.setex(key, ttl, JSON.stringify(metadata));
    
    // Add to user's active tokens
    await redis.sadd(`user_tokens:${metadata.userId}`, metadata.jti);
    await redis.expire(`user_tokens:${metadata.userId}`, ttl);
  }

  /**
   * Track token family for invalidation
   */
  async trackTokenFamily(familyId, userId, jti) {
    const key = `token_family:${familyId}`;
    const ttl = 7 * 24 * 60 * 60;
    
    await redis.sadd(key, jti);
    await redis.expire(key, ttl);
    
    // Map family to user
    await redis.set(`family_user:${familyId}`, userId);
    await redis.expire(`family_user:${familyId}`, ttl);
  }

  /**
   * Check if token was already used
   */
  async isTokenUsed(jti) {
    const used = await redis.get(`used_token:${jti}`);
    return !!used;
  }

  /**
   * Mark token as used
   */
  async markTokenAsUsed(jti) {
    const ttl = 7 * 24 * 60 * 60;
    await redis.setex(`used_token:${jti}`, ttl, '1');
  }

  /**
   * Invalidate entire token family (security breach)
   */
  async invalidateTokenFamily(familyId) {
    // Get all tokens in family
    const tokens = await redis.smembers(`token_family:${familyId}`);
    
    // Blacklist each token
    for (const jti of tokens) {
      await redis.setex(`blacklist:${jti}`, 7 * 24 * 60 * 60, '1');
    }
    
    // Get user and force re-login
    const userId = await redis.get(`family_user:${familyId}`);
    if (userId) {
      // Clear all user sessions
      await this.clearUserSessions(userId);
    }
    
    // Delete family tracking
    await redis.del(`token_family:${familyId}`);
    await redis.del(`family_user:${familyId}`);
  }

  /**
   * Clear all sessions for a user
   */
  async clearUserSessions(userId) {
    const tokens = await redis.smembers(`user_tokens:${userId}`);
    
    for (const jti of tokens) {
      await redis.setex(`blacklist:${jti}`, 7 * 24 * 60 * 60, '1');
      await redis.del(`refresh_token:${jti}`);
    }
    
    await redis.del(`user_tokens:${userId}`);
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        const ttl = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0);
        if (ttl > 0) {
          await redis.setex(`blacklist:${decoded.jti}`, ttl, '1');
        }
      }
    } catch (error) {
      console.error('Error blacklisting token:', error);
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        const blacklisted = await redis.get(`blacklist:${decoded.jti}`);
        return !!blacklisted;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      ...event,
      timestamp,
      id: crypto.randomBytes(16).toString('hex')
    };
    
    // Store in Redis list
    await redis.lpush('security_events', JSON.stringify(logEntry));
    await redis.ltrim('security_events', 0, 999); // Keep last 1000 events
    
    // Also log to console for monitoring
    console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
  }

  /**
   * Get user by ID (placeholder - integrate with your user system)
   */
  async getUserById(userId) {
    // This should query your actual user database
    // For now, returning mock data
    return {
      id: userId,
      username: 'user',
      role: 'user',
      permissions: []
    };
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId) {
    const tokenIds = await redis.smembers(`user_tokens:${userId}`);
    const sessions = [];
    
    for (const jti of tokenIds) {
      const data = await redis.get(`refresh_token:${jti}`);
      if (data) {
        sessions.push(JSON.parse(data));
      }
    }
    
    return sessions.sort((a, b) => b.lastUsed - a.lastUsed);
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId, jti) {
    // Verify session belongs to user
    const sessionData = await redis.get(`refresh_token:${jti}`);
    if (!sessionData) {
      throw new Error('Session not found');
    }
    
    const session = JSON.parse(sessionData);
    if (session.userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Blacklist the token
    await redis.setex(`blacklist:${jti}`, 7 * 24 * 60 * 60, '1');
    
    // Remove from user's active tokens
    await redis.srem(`user_tokens:${userId}`, jti);
    
    // Delete token metadata
    await redis.del(`refresh_token:${jti}`);
    
    return true;
  }
}

module.exports = new TokenService();