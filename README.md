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
  - OAuth2 Modern Authentication
  - App Password Support als Fallback
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

1. Azure AD App Registration erstellen
2. API Permissions: `SMTP.Send` 
3. Client Secret generieren
4. In config.yml eintragen:

```yaml
exchange_online:
  auth:
    method: "oauth2"
    tenant_id: "your-tenant-id"
    client_id: "your-client-id"  
    client_secret: "your-secret"
```

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

## 🔍 Monitoring

- Health Check: `http://server:8080/health`
- Logs: `/var/log/smtp-relay/`
- PM2 Status: `pm2 status`

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

1. OAuth2 Credentials korrekt?
2. Tenant ID stimmt?
3. API Permissions gesetzt?

## 📄 Lizenz

MIT - Siehe [LICENSE](LICENSE)

## 🤝 Contributing

Siehe [CONTRIBUTING.md](CONTRIBUTING.md)
