/**
 * Security validation utilities for preventing SSRF and other injection attacks
 */

const { URL } = require('url');

/**
 * Allowed Microsoft domains for API calls
 */
const ALLOWED_MICROSOFT_HOSTS = new Set([
  'graph.microsoft.com',
  'login.microsoftonline.com',
  'outlook.office365.com',
  'outlook.office.com'
]);

/**
 * Validate and sanitize tenant ID
 * @param {string} tenantId - The tenant ID to validate
 * @returns {string} - Sanitized tenant ID
 * @throws {Error} - If tenant ID is invalid
 */
function validateTenantId(tenantId) {
  // Tenant ID should be a GUID or 'common', 'organizations', 'consumers'
  const validSpecialTenants = ['common', 'organizations', 'consumers'];
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Invalid tenant ID');
  }
  
  const cleanTenantId = tenantId.trim().toLowerCase();
  
  if (!validSpecialTenants.includes(cleanTenantId) && !guidRegex.test(cleanTenantId)) {
    throw new Error('Invalid tenant ID format');
  }
  
  return cleanTenantId;
}

/**
 * Validate and sanitize email/UPN
 * @param {string} account - The account email/UPN to validate
 * @returns {string} - URL-encoded sanitized account
 * @throws {Error} - If account is invalid
 */
function validateServiceAccount(account) {
  if (!account || typeof account !== 'string') {
    throw new Error('Invalid service account');
  }
  
  // Basic email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const cleanAccount = account.trim();
  
  if (!emailRegex.test(cleanAccount)) {
    throw new Error('Invalid service account format');
  }
  
  // Encode for URL usage to prevent injection
  return encodeURIComponent(cleanAccount);
}

/**
 * Validate URL is pointing to allowed Microsoft services
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid
 * @throws {Error} - If URL is invalid or not allowed
 */
function validateMicrosoftUrl(url) {
  try {
    const parsed = new URL(url);
    
    // Check if hostname is in allowed list
    if (!ALLOWED_MICROSOFT_HOSTS.has(parsed.hostname)) {
      throw new Error(`Invalid Microsoft service URL: ${parsed.hostname} is not allowed`);
    }
    
    // Ensure HTTPS is used
    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are allowed for Microsoft services');
    }
    
    return true;
  } catch (error) {
    if (error.message.includes('Invalid Microsoft service URL')) {
      throw error;
    }
    throw new Error('Invalid URL format');
  }
}

/**
 * Validate and sanitize app/client ID
 * @param {string} appId - The application/client ID to validate
 * @returns {string} - Sanitized app ID
 * @throws {Error} - If app ID is invalid
 */
function validateAppId(appId) {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!appId || typeof appId !== 'string') {
    throw new Error('Invalid app ID');
  }
  
  const cleanAppId = appId.trim().toLowerCase();
  
  if (!guidRegex.test(cleanAppId)) {
    throw new Error('Invalid app ID format - must be a valid GUID');
  }
  
  return cleanAppId;
}

/**
 * Sanitize user input for logging (remove sensitive data)
 * @param {string} input - The input to sanitize
 * @returns {string} - Sanitized input safe for logging
 */
function sanitizeForLogging(input) {
  if (!input || typeof input !== 'string') {
    return '[invalid input]';
  }
  
  // Remove potential tokens or secrets (anything that looks like a JWT or base64 encoded secret)
  let sanitized = input.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/gi, '[REDACTED_TOKEN]');
  
  // Remove potential passwords
  sanitized = sanitized.replace(/password["\s:=]+["']?[\w\S]+["']?/gi, 'password=[REDACTED]');
  
  // Remove potential API keys
  sanitized = sanitized.replace(/api[_-]?key["\s:=]+["']?[\w\S]+["']?/gi, 'api_key=[REDACTED]');
  
  // Remove potential client secrets
  sanitized = sanitized.replace(/client[_-]?secret["\s:=]+["']?[\w\S]+["']?/gi, 'client_secret=[REDACTED]');
  
  // Remove bearer tokens
  sanitized = sanitized.replace(/bearer\s+[\w\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  
  // Limit length to prevent log flooding
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000) + '...[TRUNCATED]';
  }
  
  return sanitized;
}

/**
 * Validate redirect URI
 * @param {string} uri - The redirect URI to validate
 * @returns {string} - Validated URI
 * @throws {Error} - If URI is invalid
 */
function validateRedirectUri(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Invalid redirect URI');
  }
  
  try {
    const parsed = new URL(uri);
    
    // Allow localhost for development
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return uri;
    }
    
    // Require HTTPS for production
    if (parsed.protocol !== 'https:') {
      throw new Error('Redirect URI must use HTTPS');
    }
    
    // Prevent open redirects - check against configured allowed domains
    // This should be configured based on your application's needs
    const allowedRedirectHosts = process.env.ALLOWED_REDIRECT_HOSTS ? 
      process.env.ALLOWED_REDIRECT_HOSTS.split(',').map(h => h.trim()) : 
      ['localhost', '127.0.0.1'];
    
    if (!allowedRedirectHosts.includes(parsed.hostname)) {
      throw new Error('Redirect URI hostname not allowed');
    }
    
    return uri;
  } catch (error) {
    if (error.message.includes('Redirect URI')) {
      throw error;
    }
    throw new Error('Invalid redirect URI format');
  }
}

module.exports = {
  validateTenantId,
  validateServiceAccount,
  validateMicrosoftUrl,
  validateAppId,
  sanitizeForLogging,
  validateRedirectUri,
  ALLOWED_MICROSOFT_HOSTS
};