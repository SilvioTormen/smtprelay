# Data Security Notice

## Important Security Information

The `data/` directory contains sensitive application data including:
- User credentials (encrypted)
- MFA secrets (encrypted)
- Backup codes (encrypted)
- Session data

## Security Measures

1. **Never commit the data/ directory to version control**
   - The `.gitignore` file is configured to exclude this directory
   - All files in `data/` contain sensitive information

2. **Encryption**
   - All sensitive data is encrypted using AES-256-GCM
   - Encryption keys are automatically generated on first run
   - Keys are stored in `data/.encryption.key`

3. **Default Credentials**
   - Username: `admin`
   - Password: `Admin123!@#`
   - **CHANGE THESE IMMEDIATELY** after first login

## Setup Instructions

1. The `data/` directory will be created automatically when the application starts
2. User and MFA data files will be generated with proper encryption
3. Ensure proper file permissions on the `data/` directory (700 recommended)

## Backup Recommendations

- Regularly backup the `data/` directory to a secure location
- Never store backups in version control
- Keep backups encrypted and access-controlled

## If Data Was Accidentally Committed

If sensitive data was accidentally committed to Git:
1. Remove files from tracking: `git rm -r --cached data/`
2. Update .gitignore
3. Commit the changes
4. Consider rotating all secrets and credentials
5. Use `git filter-branch` or BFG Repo-Cleaner to remove from history if needed