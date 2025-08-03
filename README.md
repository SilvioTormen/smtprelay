# Legacy SMTP Relay für Exchange Online

Ein einfacher, robuster SMTP Relay Service für Legacy-Geräte (Drucker, Scanner, alte Applikationen) die E-Mails über Exchange Online/Microsoft 365 versenden müssen.

## 🎯 Features

- **Multi-Port Support**: 
  - Port 25 (Plain SMTP für alte Geräte)
  - Port 587 (STARTTLS für neuere Geräte)  
  - Port 465 (Implicit TLS für spezielle Geräte)
  
- **Legacy-freundlich**:
  - Keine Authentifizierung für IP-Whitelist
  - Statische User für Legacy-Geräte
  - Unterstützt alte TLS-Versionen (TLS 1.0+)
  - Relaxed SMTP für nicht-konforme Geräte
  - 8-bit MIME Support für alte Systeme

- **Exchange Online Integration**:
  - OAuth2 Modern Authentication (Device Code, Authorization Code, Client Credentials)
  - Interaktives Setup mit Wizard
  - Automatische Token-Erneuerung
  - Microsoft Graph API Alternative

## 📋 Voraussetzungen

- Red Hat Enterprise Linux 8/9/10 oder kompatibel (Rocky Linux, AlmaLinux, CentOS Stream)
- Node.js 18+ (LTS empfohlen: v20.x, RHEL 10 hat v22 vorinstalliert)
- Exchange Online/Microsoft 365 Account mit aktivem Abonnement
- Azure AD App Registration für OAuth2
- Firmen-internes Netzwerk oder sichere DMZ
- Redis (optional, für Sessions und Caching)

## 🚀 Schnellstart

### 1. Installation mit Ansible

```bash
# Repository klonen
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay

# Config vorbereiten
cp config.example.yml config.yml

# OAuth2 Setup Wizard ausführen (empfohlen)
npm run setup:auth

# Oder manuell anpassen
vim config.yml

# Mit Ansible deployen
ansible-playbook -i inventory/hosts.yml ansible/deploy.yml
```

### 2. Manuelle Installation

#### Schritt 1: Node.js installieren (WICHTIG - zuerst prüfen!)

```bash
# Prüfen ob Node.js installiert ist
node --version

# Falls nicht installiert:

# Für RHEL/Rocky/AlmaLinux 8-9:
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Für RHEL 10 (hat normalerweise Node.js 22 vorinstalliert):
# Falls nicht vorhanden:
sudo dnf install nodejs npm
```

#### Schritt 2: Repository klonen und Setup

```bash
# Repository klonen
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay

# Dependencies installieren (inkl. Dashboard)
npm install
npm install --prefix dashboard

# Initial Setup ausführen (generiert .env automatisch)
npm run setup

# Non-Interactive Mode für Automatisierung:
npm run setup -- --non-interactive

# OAuth2 Setup Wizard ausführen (optional)
npm run setup:auth

# Service-Benutzer anlegen
sudo useradd -r -s /bin/false smtp-relay

# Dateien verschieben und Berechtigungen setzen
sudo mv ../smtprelay /opt/smtp-relay
sudo chown -R smtp-relay:smtp-relay /opt/smtp-relay
sudo mkdir -p /var/log/smtp-relay
sudo chown smtp-relay:smtp-relay /var/log/smtp-relay

# Als Service installieren
sudo cp /opt/smtp-relay/smtp-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable smtp-relay
sudo systemctl start smtp-relay

# Status prüfen
sudo systemctl status smtp-relay
sudo journalctl -u smtp-relay -f
```

#### Port-Berechtigungen

Der Service nutzt standardmäßig Ports > 1024 (2525, 2587, 2465) um Berechtigungsprobleme zu vermeiden.

Für Standard SMTP-Ports (25, 587, 465):

```bash
# Option 1: Capabilities für Node.js setzen (empfohlen)
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# Option 2: Systemd Capabilities (bereits in Service-Datei konfiguriert)
# Der Service hat CAP_NET_BIND_SERVICE bereits aktiviert

# Option 3: Port-Forwarding mit iptables
sudo iptables -t nat -A PREROUTING -p tcp --dport 25 -j REDIRECT --to-port 2525
sudo iptables -t nat -A PREROUTING -p tcp --dport 587 -j REDIRECT --to-port 2587
sudo iptables -t nat -A PREROUTING -p tcp --dport 465 -j REDIRECT --to-port 2465
```


### 3. Mit PM2 (empfohlen für Entwicklung)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## ⚙️ Konfiguration

### Exchange Online OAuth2 Setup

#### Schnellstart mit Setup Wizard (Empfohlen)

```bash
# Interaktiver OAuth2 Setup Wizard
npm run setup:auth
```

Der Wizard führt dich durch:
- Auswahl der Authentifizierungsmethode
- Azure AD Konfiguration
- Automatische Token-Generierung

#### Verfügbare OAuth2 Methoden

**1. Device Code Flow** (Empfohlen für Server)
```yaml
exchange_online:
  auth:
    method: "device_code"
    tenant_id: "your-tenant-id"  # oder "common"
    client_id: "your-client-id"
```

**2. Client Credentials** (Für Automatisierung)
```yaml
exchange_online:
  auth:
    method: "client_credentials"
    tenant_id: "your-tenant-id"
    client_id: "your-client-id"  
    client_secret: "your-secret"
    send_as: "relay@domain.com"
```

**3. Authorization Code** (Für Web Dashboard)
```yaml
exchange_online:
  auth:
    method: "authorization_code"
    tenant_id: "your-tenant-id"
    client_id: "your-client-id"
    redirect_uri: "http://localhost:3001/api/auth/callback"
```

Detaillierte Anleitung: [OAuth2 Setup Guide](docs/OAUTH2_SETUP.md)

### Legacy Geräte konfigurieren

```yaml
# IP-Whitelist für Geräte ohne Auth
ip_whitelist:
  no_auth_required:
    - "192.168.1.0/24"  # Drucker VLAN
    
# Statische User für Geräte mit Auth
legacy_auth:
  static_users:
    - username: "scanner"
      password: "CHANGE_THIS_USE_STRONG_PASSWORD"  # Min. 16 Zeichen!
      allowed_ips: ["192.168.1.0/24"]
```

## 🔍 Monitoring & Management

### Web Dashboard
- **URL**: `http://server:3001` (Development) oder `https://server` (Production mit Reverse Proxy)
- **Features**: 
  - Real-time Statistiken
  - Device Management
  - Queue Monitoring
  - Multi-Factor Authentication (TOTP + FIDO2/YubiKey)

### System Monitoring
- Health Check: `http://server:3001/api/health`
- Logs: `/var/log/smtp-relay/`
- PM2 Status: `pm2 status`
- Security Check: `npm run security:check`

## 📝 Typische Legacy-Geräte

| Gerät | Port | Auth | TLS |
|-------|------|------|-----|
| Alte Drucker | 25 | Nein | Nein |
| Moderne Drucker | 587 | Optional | STARTTLS |
| NAS Systeme | 587 | Ja | STARTTLS |
| Monitoring Tools | 25 | Nein | Optional |
| Security Kameras | 587 | Ja | STARTTLS |

## 🛠️ Troubleshooting

### Gerät kann nicht senden

1. IP in Whitelist? Check: `config.yml`
2. Firewall offen? Check: `sudo firewall-cmd --list-all`
3. Logs prüfen: `tail -f /var/log/smtp-relay/relay.log`

### Exchange Authentifizierung fehlgeschlagen

1. Setup Wizard erneut ausführen: `npm run setup:auth`
2. Token-Status prüfen: `cat .tokens.json`
3. Azure AD Permissions checken:
   - Device Code: `Mail.Send`, `SMTP.Send`, `offline_access`
   - Client Credentials: `Mail.Send` (Application)
4. Tokens löschen und neu authentifizieren:
   ```bash
   rm .tokens.json
   npm run setup:auth
   ```

## 🔒 Security Features (10/10 Enterprise Grade)

### 🛡️ Authentication & Authorization
- **Multi-Factor Authentication (MFA)**
  - TOTP Support (Google Authenticator, Microsoft Authenticator)
  - Backup Codes für Notfallzugriff
  - MFA Enforcement bei verdächtigen Aktivitäten
- **OAuth2 Modern Authentication**
  - Device Code Flow für Server
  - Client Credentials für Automatisierung
  - Authorization Code für Web-Anwendungen
  - Automatisches Token Refresh
- **httpOnly Cookie Authentication**
  - JWT Tokens in sicheren httpOnly Cookies
  - Kein localStorage - XSS-Schutz
  - Automatic CSRF Protection

### 🔐 Advanced Token Security
- **Refresh Token Rotation**
  - Neue Tokens bei jedem Refresh
  - Token-Familie Tracking
  - Replay Attack Detection - Automatische Invalidierung bei Missbrauch
  - JTI (JWT ID) für eindeutige Token-Identifikation
- **Token Blacklisting**
  - Redis-basierte Blacklist
  - Sofortige Token-Invalidierung bei Logout
  - Persistente Speicherung

### 🕵️ Anomaly Detection & Device Security
- **Device Fingerprinting**
  - Browser & OS Detection
  - IP-basiertes Fingerprinting
  - Trust Score Berechnung (0.0-1.0)
  - Automatische Re-Authentication bei Device-Wechsel
- **Advanced Anomaly Detection**
  - **Impossible Travel Detection**: Login von Berlin und 5 Min später von Tokyo? Blockiert!
  - **Brute Force Detection**: Erkennung automatisierter Angriffe
  - **VPN/Proxy/Tor Detection**: Verdächtige Verbindungen werden erkannt
  - **Unusual Time Detection**: Login um 3 Uhr morgens?
  - **Risk-Based Authentication**: Automatische MFA bei hohem Risiko

### 🚪 Access Control
- **IP Whitelist Management**
  - Separate Listen für SMTP Relay und Dashboard
  - CIDR Notation Support (192.168.0.0/24)
  - Blacklist für komplett blockierte IPs
  - Web-basierte Verwaltung mit Audit Trail
- **Exponential Backoff Lockout**
  - 3 Versuche: 1 Minute Sperre
  - 4 Versuche: 5 Minuten
  - 5 Versuche: 15 Minuten
  - 6 Versuche: 1 Stunde
  - 7+ Versuche: 24 Stunden
- **Rate Limiting**
  - Per-IP und Per-User Limits
  - DDoS Protection
  - API Endpoint Protection

### 📱 Session Management
- **Multi-Device Session Control**
  - Alle aktiven Sessions anzeigen
  - Remote Session Revocation
  - "Logout Everywhere Else" Feature
  - Device & Location Tracking
- **Session Security**
  - Redis-basierte Session Storage
  - Session Timeout Management
  - Concurrent Session Limits
  - Session Activity Monitoring

### 🔍 Security Headers & Policies
- **Comprehensive Security Headers**
  - Content Security Policy (CSP)
  - HTTP Strict Transport Security (HSTS) mit Preload
  - X-Frame-Options: DENY (Clickjacking Protection)
  - X-Content-Type-Options: nosniff
  - Permissions Policy (Kamera, Mikrofon, etc. blockiert)
  - Expect-CT Enforcement
  - Cache-Control: no-store
- **CORS Protection**
  - Strict Origin Policy
  - Credentials Support mit Whitelisting
- **CSRF Protection**
  - Double-Submit Cookie Pattern
  - Token Validation
  - SameSite Cookie Attribute

### 📊 Monitoring & Auditing
- **Comprehensive Audit Logging**
  - Alle Security Events
  - Login/Logout Tracking
  - Configuration Changes
  - Failed Authentication Attempts
  - IP Whitelist Änderungen
- **Security Event Dashboard**
  - Real-time Security Alerts
  - Suspicious Activity Timeline
  - Failed Login Attempts
  - Geographic Login Map

### 🔧 Infrastructure Security
- **Secure File Operations**
  - Atomic File Writes
  - File Locking gegen Race Conditions
  - Path Traversal Protection
  - Symlink Detection
- **Input Validation**
  - Strict Type Checking
  - SQL Injection Protection
  - Command Injection Protection
  - XSS Prevention
  - Length Limits
- **Cryptographic Security**
  - Timing-Safe Comparisons
  - Secure Random Generation
  - Strong Password Hashing (bcrypt)
  - SHA-256 für Fingerprints

### 🏆 Security Score Breakdown

| Security Feature | Status | Score |
|-----------------|--------|-------|
| httpOnly Cookies | ✅ | 1.5/1.5 |
| CSRF Protection | ✅ | 1.0/1.0 |
| Token Rotation | ✅ | 0.5/0.5 |
| Device Fingerprinting | ✅ | 0.5/0.5 |
| Anomaly Detection | ✅ | 0.5/0.5 |
| Rate Limiting | ✅ | 0.5/0.5 |
| MFA + Backup Codes | ✅ | 1.0/1.0 |
| IP Whitelisting | ✅ | 0.5/0.5 |
| Session Management | ✅ | 0.5/0.5 |
| Security Headers | ✅ | 1.0/1.0 |
| Audit Logging | ✅ | 0.5/0.5 |
| Input Validation | ✅ | 0.5/0.5 |
| Exponential Backoff | ✅ | 0.5/0.5 |
| Redis Sessions | ✅ | 0.5/0.5 |
| VPN/Tor Detection | ✅ | 0.5/0.5 |
| **TOTAL** | **100%** | **10.0/10** |

### 🚀 Security Commands

```bash
# Generate secure secrets for production
npm run security:generate

# Check for vulnerabilities
npm run security:check

# View security audit log
tail -f logs/security-audit.log

# Test security headers
npm run test:security-headers

# Monitor failed login attempts
grep "LOGIN_FAILED" logs/auth-failures.log | tail -20
```

## 📄 Lizenz

MIT - Siehe [LICENSE](LICENSE)

## 🤝 Contributing

Siehe [CONTRIBUTING.md](CONTRIBUTING.md)
