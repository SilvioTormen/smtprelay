# 📧 SMTP Relay Authentication Methods Guide

## 🎯 Quick Decision Helper

### Choose **Method A: Microsoft Graph API** if:
- ✅ You want the **RECOMMENDED** modern approach
- ✅ SMTP Auth is disabled in your organization
- ✅ You want better security and monitoring
- ✅ You're setting up a new system

⚠️ **SECURITY WARNING**: Application Permissions (Client Credentials) grant access to ALL mailboxes by default! See security section below.

### Choose **Method B: SMTP Protocol with OAuth2** if:
- ⚠️ You need legacy compatibility
- ⚠️ You have existing SMTP-based monitoring
- ⚠️ Graph API is blocked in your environment
- ⚠️ You need specific SMTP features

### Choose **Method C: Both (Hybrid)** if:
- 🔄 You want automatic fallback
- 🔄 You're migrating from SMTP to Graph
- 🔄 You need maximum compatibility

---

## 📊 Detailed Comparison

| Feature | Method A: Graph API | Method B: SMTP OAuth2 | 
|---------|-------------------|---------------------|
| **Recommendation** | ✅ **RECOMMENDED** | ⚠️ Legacy Support |
| **Azure AD Permission** | `Mail.Send` (Microsoft Graph) | `SMTP.Send` (Office 365 Exchange) |
| **SMTP Auth Required** | ❌ No | ✅ Yes |
| **Future-Proof** | ✅ Yes | ⚠️ Being phased out |
| **Setup Complexity** | 🟢 Simple | 🟡 Moderate |
| **Performance** | 🚀 Fast | 🔄 Standard |
| **Rate Limits** | 📈 Higher | 📉 Lower |

---

## 🔧 Method A: Microsoft Graph API (RECOMMENDED)

### Step 1: Azure AD Setup
```bash
1. Go to Azure Portal → App registrations
2. Select your app → API permissions
3. Add permission → Microsoft Graph → Delegated permissions
4. Search for "Mail" → Select "Mail.Send"
5. Grant admin consent ✅
```

### Step 2: Configure smtprelay
```yaml
# config.yml
exchange_online:
  method: "graph_api"  # ← USE THIS
  auth:
    tenant_id: "your-tenant-id"
    client_id: "your-client-id"
    # For Device Code Flow (recommended for servers)
    method: "device_code"
```

### Step 3: Run Setup
```bash
npm run setup:auth
# Select: 1 (Device Code Flow)
# Select: Use Graph API Only
```

### What Happens:
```
Legacy Device → Your Relay → Graph API → Exchange Online
                            ↑
                     NO SMTP Protocol!
```

---

## ⚠️ Method B: SMTP Protocol with OAuth2 (Legacy)

### Step 1: Azure AD Setup
```bash
1. Go to Azure Portal → App registrations
2. Select your app → API permissions
3. Add permission → APIs my organization uses
4. Search: "Office 365 Exchange Online"
5. Delegated permissions → "SMTP.Send"
6. Grant admin consent ✅
```

### Step 2: Enable SMTP Auth (Required!)
```powershell
# In Exchange Online PowerShell:
Set-CASMailbox -Identity relay@domain.com -SmtpClientAuthenticationDisabled $false
```

### Step 3: Configure smtprelay
```yaml
# config.yml
exchange_online:
  method: "smtp_oauth2"  # ← USE THIS
  host: "smtp.office365.com"
  port: 587
  auth:
    tenant_id: "your-tenant-id"
    client_id: "your-client-id"
    method: "device_code"
```

### What Happens:
```
Legacy Device → Your Relay → SMTP Protocol → Exchange Online
                            ↑
                    Uses OAuth2 Token
```

---

## 🔄 Method C: Hybrid Mode (Both APIs)

### Step 1: Add BOTH Permissions in Azure AD
```bash
Microsoft Graph:
  ✅ Mail.Send
  
Office 365 Exchange Online:
  ✅ SMTP.Send
```

### Step 2: Configure smtprelay
```yaml
# config.yml
exchange_online:
  method: "hybrid"  # ← Automatic fallback
  primary: "graph_api"  # Try Graph first
  fallback: "smtp_oauth2"  # Fall back to SMTP
  
  # Graph API config
  graph_api:
    endpoint: "https://graph.microsoft.com/v1.0"
    
  # SMTP config (fallback)
  smtp:
    host: "smtp.office365.com"
    port: 587
    
  # Auth (used by both)
  auth:
    tenant_id: "your-tenant-id"
    client_id: "your-client-id"
    method: "device_code"
```

### What Happens:
```
Legacy Device → Your Relay → Try Graph API → Exchange Online
                           ↓ (if fails)
                          Try SMTP OAuth2
```

---

## ❓ Common Questions

### Q: Which method does Microsoft recommend?
**A:** Microsoft strongly recommends Graph API. SMTP Auth is being deprecated.

### Q: Can I switch methods later?
**A:** Yes! Start with Graph API. Add SMTP permissions later if needed.

### Q: What if Graph API is blocked by firewall?
**A:** Use SMTP OAuth2 as fallback, but plan to migrate to Graph API.

### Q: Do I need both permissions for testing?
**A:** No. Start with Graph API only. Add SMTP.Send only if you need Method B.

---

## 🚀 Quick Start Commands

### For Graph API Only (Recommended):
```bash
npm run setup:auth -- --method graph
```

### For SMTP OAuth2 Only (Legacy):
```bash
npm run setup:auth -- --method smtp
```

### For Hybrid Mode:
```bash
npm run setup:auth -- --method hybrid
```

---

## 📋 Checklist by Method

### ✅ Graph API Checklist:
- [ ] Azure AD App registered
- [ ] `Mail.Send` permission added (Microsoft Graph)
- [ ] Admin consent granted
- [ ] Device Code Flow tested
- [ ] config.yml set to `method: "graph_api"`

### ⚠️ SMTP OAuth2 Checklist:
- [ ] Azure AD App registered
- [ ] `SMTP.Send` permission added (Office 365 Exchange)
- [ ] Admin consent granted
- [ ] SMTP Auth enabled on mailbox
- [ ] Device Code Flow tested
- [ ] config.yml set to `method: "smtp_oauth2"`

### 🔄 Hybrid Checklist:
- [ ] Both permissions added
- [ ] Admin consent for both
- [ ] Primary/fallback configured
- [ ] Both methods tested individually
- [ ] Fallback triggers verified

---

## 🆘 Troubleshooting

### Error: "SMTP.Send scope not found"
```
Solution: You added it to Microsoft Graph instead of Office 365 Exchange API
Fix: Remove from Graph, add to Office 365 Exchange Online API
```

### Error: "Mail.Send not working"
```
Solution: Check if you have the Microsoft Graph permission (not Exchange)
Fix: Add Mail.Send from Microsoft Graph, not Exchange
```

### Error: "Authentication failed for SMTP"
```
Solution: SMTP Auth might be disabled
Fix: Enable SMTP Auth or switch to Graph API method
```

---

## 🔒 CRITICAL SECURITY CONSIDERATION

### Application vs Delegated Permissions

| Permission Type | Access Scope | Security Risk | Use Case |
|----------------|--------------|---------------|----------|
| **Application** (Client Credentials) | ALL mailboxes in tenant | ⚠️ **HIGH** - Can send as anyone! | Automated services WITH restrictions |
| **Delegated** (Device/Auth Code) | Only authenticated user | ✅ **LOW** - Limited to one mailbox | Recommended for most scenarios |

### Securing Application Permissions

If you MUST use Application Permissions (Client Credentials):

```powershell
# CRITICAL: Restrict to specific mailbox only!
# 1. Create security group
New-DistributionGroup -Name "SMTPRelayMailboxes" -Type Security

# 2. Add ONLY relay mailbox
Add-DistributionGroupMember -Identity "SMTPRelayMailboxes" -Member "relay@domain.com"

# 3. Apply access policy
New-ApplicationAccessPolicy -AppId "your-app-id" `
  -PolicyScopeGroupId "SMTPRelayMailboxes" `
  -AccessRight RestrictAccess
```

**Without this restriction, the app can send emails as ANY user in your organization!**

### Recommended Approach

1. **Best**: Use Delegated Permissions (Device Code) with dedicated service account
2. **Good**: Use Application Permissions WITH Access Policy restrictions
3. **AVOID**: Unrestricted Application Permissions

## 📈 Migration Path

```
Current State          Recommended Path
─────────────         ─────────────────
SMTP with Password → SMTP with OAuth2 → Graph API Only ✅
                          ↑                    ↑
                    You are here      Target State
```

**Timeline:**
1. **Now:** Use Graph API for new setups
2. **Soon:** Migrate existing SMTP to Graph API  
3. **Future:** Microsoft will disable SMTP Auth completely

---

## 💡 Best Practices

1. **Always start with Graph API** - It's the future
2. **Only add SMTP if required** - For specific legacy needs
3. **Use Device Code Flow** - Best for server applications
4. **Monitor deprecation notices** - Microsoft will phase out SMTP
5. **Test both methods** - If using hybrid mode

---

## 📞 Need Help?

Run the diagnostic command:
```bash
npm run diagnose:auth
```

This will check:
- Which permissions are configured
- Which methods are available  
- Current configuration status
- Recommendations for your setup