# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.5.x   | :white_check_mark: |
| 1.0.x   | :x: |
| < 1.0   | :x: |

## Reporting a Vulnerability

We take the security of SMTP Relay seriously. If you have discovered a security vulnerability, please follow these steps:

### Where to Report

**DO NOT** report security vulnerabilities through public GitHub issues.

Instead, please report them via:
- GitHub Security Advisories: [Create a security advisory](https://github.com/SilvioTormen/smtprelay/security/advisories/new)
- Alternative: Open a private issue with security label

### What to Include

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the issue
- Location of affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Assessment**: Within 1 week
- **Resolution**: Depending on severity:
  - Critical: Within 1-2 weeks
  - High: Within 2-4 weeks
  - Medium: Within 4-8 weeks
  - Low: Next regular release

## Security Best Practices

When deploying SMTP Relay:

### Authentication & Authorization
- Always use strong authentication for SMTP connections
- Implement rate limiting to prevent abuse
- Use OAuth 2.0 for Exchange Online connections
- Never store credentials in plain text

### Network Security
- Use TLS/SSL for all SMTP connections
- Implement IP whitelisting where possible
- Use firewall rules to restrict access
- Monitor for unusual activity patterns

### Configuration Security
- Store sensitive configuration in environment variables
- Use encrypted secrets management systems
- Regularly rotate credentials
- Implement least privilege principles

### Logging & Monitoring
- Log all authentication attempts
- Monitor for unusual sending patterns
- Set up alerts for security events
- Regularly review logs for anomalies

### Updates & Patches
- Keep all dependencies up to date
- Subscribe to security advisories
- Test updates in staging before production
- Have a rollback plan

## Disclosure Policy

When we receive a security report:

1. Confirm the problem and determine affected versions
2. Audit code to find similar problems
3. Prepare fixes for all supported releases
4. Release new security fix versions
5. Prominently announce the problem after fixes are available

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request.

## Acknowledgments

We thank the following researchers for responsibly disclosing vulnerabilities:

- (List will be updated as vulnerabilities are reported and fixed)