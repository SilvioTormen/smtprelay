# Legacy SMTP Relay für Exchange Online

Ein einfacher, robuster SMTP Relay Service für Legacy-Geräte (Drucker, Scanner, alte Applikationen) die E-Mails über Exchange Online/Microsoft 365 versenden müssen.

## 🎯 Features

- **Multi-Port Support**: 
  - Port 25 (Plain SMTP für alte Geräte)
  - Port 587 (STARTTLS für neuere Geräte)  
  - Port 465 (Implicit TLS für spezielle Geräte)
  
- **Legacy-freundlich**:
  - Keine Authentifizierung für IP-Whitelist
  - Einfache Username/Password Auth
  - Unterstützt alte TLS-Versionen
  - Relaxed SMTP für nicht-konforme Geräte

- **Exchange Online Integration**:
  - OAuth2 Modern Authentication (Device Code, Authorization Code, Client Credentials)
  - Interaktives Setup mit Wizard
  - Automatische Token-Erneuerung
  - Microsoft Graph API Alternative

## 📋 Voraussetzungen

- Red Hat Enterprise Linux 8/9 oder kompatibel
- Node.js 18+ 
- Exchange Online/Microsoft 365 Account
- Firmen-internes Netzwerk

## 🚀 Schnellstart

### 1. Installation mit Ansible

```bash
# Repository klonen
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay

# Config anpassen
cp config.example.yml config.yml
vim config.yml

# Mit Ansible deployen
ansible-playbook -i inventory/hosts.yml ansible/deploy.yml
```

### 2. Manuelle Installation

```bash
# Node.js installieren
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Repository klonen
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay

# Dependencies installieren
npm install

# Config anpassen
cp config.example.yml config.yml

# Als Service installieren
sudo cp smtp-relay.service /etc/systemd/system/
sudo systemctl enable smtp-relay
sudo systemctl start smtp-relay
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
      password: "ScannerPass123"
      allowed_ips: ["192.168.1.0/24"]
```

## 🔍 Monitoring & Management

### Web Dashboard
- **URL**: `http://server:3001`
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

## 🔒 Security Features

- **Multi-Factor Authentication**: TOTP (Microsoft Authenticator) + FIDO2 (YubiKey)
- **OAuth2 Modern Authentication**: Keine Passwörter im Code
- **Automatische Security Checks**: `npm run security:check`
- **Sichere Token-Speicherung**: Automatisches Refresh
- **Rate Limiting & IP Whitelisting**: DDoS Schutz
- **Security Headers**: CSP, HSTS, etc.

## 📄 Lizenz

MIT - Siehe [LICENSE](LICENSE)

## 🤝 Contributing

Siehe [CONTRIBUTING.md](CONTRIBUTING.md)
