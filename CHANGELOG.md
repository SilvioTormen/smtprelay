# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2025-08-08

### Added
- **Azure Auto Setup Wizard** - Fully automated Azure AD app registration
- **Exchange Configuration Management** - Automated mail flow and connector setup
- **Setup Progress Tracker** - Visual progress tracking for complex setup tasks
- **Token Management Service** - Centralized OAuth token handling with automatic refresh
- **Multiple Setup Modes**:
  - Simple setup for basic configurations
  - Admin setup for full automation
  - Manual setup for custom configurations
- **Exchange Setup UI** - Comprehensive web interface for Exchange configuration
- **Error Recovery** - Automatic retry mechanisms with exponential backoff
- **Setup Documentation** - Detailed Azure setup guide (docs/AZURE_AUTO_SETUP.md)

### Changed
- Improved OAuth2 authentication flow with better error handling
- Enhanced CSRF protection in API middleware
- Updated authentication routes with additional debugging capabilities
- Modernized README with clearer structure and better documentation

### Security
- Added secure token storage with proper file permissions
- Implemented comprehensive error handling for Azure API calls
- Enhanced authentication context debugging for troubleshooting

## [1.5.0] - 2025-08-07

### Added
- **Enterprise Security Features**:
  - Multi-Factor Authentication (TOTP + FIDO2)
  - Device fingerprinting and trust scoring
  - Anomaly detection (impossible travel, unusual time)
  - VPN/Proxy/Tor detection
  - Exponential backoff lockout
- **Advanced Token Security**:
  - Refresh token rotation
  - Token blacklisting with Redis
  - JWT ID tracking for replay attack prevention
- **Session Management**:
  - Multi-device session control
  - Remote session revocation
  - "Logout everywhere else" feature
- **Security Headers**:
  - Content Security Policy (CSP)
  - HTTP Strict Transport Security (HSTS)
  - Complete security header suite
- **IP Whitelist Management**:
  - Web-based IP whitelist configuration
  - CIDR notation support
  - Separate lists for SMTP and dashboard access

### Changed
- Upgraded authentication to use httpOnly cookies
- Improved rate limiting with per-IP and per-user limits
- Enhanced audit logging with comprehensive security events

### Security
- Implemented timing-safe comparisons for cryptographic operations
- Added path traversal protection
- Enhanced input validation and sanitization

## [1.0.0] - 2025-08-05

### Added
- **Core SMTP Relay Functionality**:
  - Multi-port support (25, 587, 465)
  - Legacy device compatibility
  - TLS support with STARTTLS
- **OAuth2 Authentication**:
  - Device Code Flow
  - Authorization Code Flow
  - Client Credentials Flow
- **Microsoft Graph API Integration**
- **Web Dashboard**:
  - Real-time statistics
  - Device management
  - Queue monitoring
- **Ansible Deployment Playbooks**
- **Redis Integration** for sessions and caching
- **Comprehensive Documentation**:
  - OAuth2 setup guide
  - MFA setup guide
  - TLS management guide
  - Authentication methods comparison

### Security
- Basic authentication mechanisms
- IP whitelist support
- Static user authentication for legacy devices

## [0.1.0] - 2025-08-02

### Added
- Initial repository structure
- Basic documentation files
- License (MIT)
- Project planning documents