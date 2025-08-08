const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { authenticate } = require('../middleware/auth');
const { requireConfigure } = require('../middleware/rbac');

// Get system information - Admin only (requireConfigure ensures admin access)
router.get('/info', authenticate, requireConfigure, async (req, res) => {
    try {
        // Basic system info
        const hostname = os.hostname();
        const platform = os.platform();
        const osVersion = os.release();
        const arch = os.arch();
        const uptime = os.uptime();
        const cpuCores = os.cpus().length;
        const loadAvg = os.loadavg();
        
        // Memory info
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        // Network interfaces
        const networkInterfaces = os.networkInterfaces();
        const ips = [];
        Object.values(networkInterfaces).forEach(interfaces => {
            interfaces.forEach(iface => {
                if (!iface.internal && iface.family === 'IPv4') {
                    ips.push(iface.address);
                }
            });
        });
        
        // Get disk usage
        let diskInfo = { total: 0, used: 0, free: 0 };
        try {
            const { stdout } = await execAsync('df -B1 /');
            const lines = stdout.split('\n');
            if (lines.length > 1) {
                const parts = lines[1].split(/\s+/);
                diskInfo = {
                    total: parseInt(parts[1]) || 0,
                    used: parseInt(parts[2]) || 0,
                    free: parseInt(parts[3]) || 0
                };
            }
        } catch (err) {
            console.error('Error getting disk usage:', err);
        }
        
        // Get PM2 status
        let pm2Info = { status: 'unknown', uptime: 'unknown', restarts: 0 };
        try {
            const { stdout } = await execAsync('pm2 jlist');
            const processes = JSON.parse(stdout);
            const smtpRelay = processes.find(p => p.name === 'smtp-relay');
            if (smtpRelay) {
                pm2Info = {
                    status: smtpRelay.pm2_env.status,
                    uptime: smtpRelay.pm2_env.pm_uptime ? 
                        new Date(smtpRelay.pm2_env.pm_uptime).toLocaleString() : 'unknown',
                    restarts: smtpRelay.pm2_env.restart_time || 0,
                    memory: smtpRelay.monit?.memory || 0,
                    cpu: smtpRelay.monit?.cpu || 0
                };
            }
        } catch (err) {
            console.error('Error getting PM2 status:', err);
        }
        
        // Get application info
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        let appVersion = 'unknown';
        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            appVersion = packageJson.version;
        } catch (err) {
            console.error('Error reading package.json:', err);
        }
        
        // Check Exchange configuration
        let exchangeInfo = { configured: false, accounts: 0 };
        try {
            const configPath = path.join(process.cwd(), 'config.yml');
            const configExists = await fs.access(configPath).then(() => true).catch(() => false);
            
            if (configExists) {
                const yaml = require('yaml');
                const configContent = await fs.readFile(configPath, 'utf8');
                const config = yaml.parse(configContent);
                
                exchangeInfo.configured = !!config.exchange_online?.auth?.client_id;
                
                // Count token accounts
                const tokenPath = path.join(process.cwd(), 'data', 'exchange-tokens.encrypted');
                const tokenExists = await fs.access(tokenPath).then(() => true).catch(() => false);
                if (tokenExists) {
                    // We can't decrypt here, but we know tokens exist
                    exchangeInfo.accounts = 1; // At least one account
                }
            }
        } catch (err) {
            console.error('Error checking Exchange config:', err);
        }
        
        // Check TLS certificate
        let tlsInfo = { status: 'Not configured', valid: false };
        try {
            const certPath = path.join(process.cwd(), 'certs', 'cert.pem');
            const certExists = await fs.access(certPath).then(() => true).catch(() => false);
            if (certExists) {
                tlsInfo.status = 'Configured';
                tlsInfo.valid = true;
                // Could add certificate expiry check here
            }
        } catch (err) {
            console.error('Error checking TLS cert:', err);
        }
        
        // Check IP whitelist
        let ipWhitelistInfo = { enabled: false, count: 0 };
        try {
            const whitelistPath = path.join(process.cwd(), 'ip-whitelist.json');
            const whitelistExists = await fs.access(whitelistPath).then(() => true).catch(() => false);
            if (whitelistExists) {
                const whitelist = JSON.parse(await fs.readFile(whitelistPath, 'utf8'));
                ipWhitelistInfo.enabled = whitelist.enabled || false;
                ipWhitelistInfo.count = whitelist.addresses ? whitelist.addresses.length : 0;
            }
        } catch (err) {
            console.error('Error checking IP whitelist:', err);
        }
        
        // Check MFA status
        let mfaEnabled = false;
        try {
            const mfaPath = path.join(process.cwd(), 'data', 'mfa.json');
            const mfaExists = await fs.access(mfaPath).then(() => true).catch(() => false);
            if (mfaExists) {
                const mfaData = JSON.parse(await fs.readFile(mfaPath, 'utf8'));
                mfaEnabled = Object.keys(mfaData).length > 0;
            }
        } catch (err) {
            console.error('Error checking MFA status:', err);
        }
        
        // Get queue count
        let queueCount = 0;
        try {
            const queuePath = path.join(process.cwd(), 'queue');
            const queueExists = await fs.access(queuePath).then(() => true).catch(() => false);
            if (queueExists) {
                const files = await fs.readdir(queuePath);
                queueCount = files.filter(f => f.endsWith('.json')).length;
            }
        } catch (err) {
            console.error('Error checking queue:', err);
        }
        
        // Get log files size
        let logSize = 0;
        try {
            const logsPath = path.join(process.cwd(), 'logs');
            const logsExist = await fs.access(logsPath).then(() => true).catch(() => false);
            if (logsExist) {
                const files = await fs.readdir(logsPath);
                for (const file of files) {
                    const stat = await fs.stat(path.join(logsPath, file));
                    logSize += stat.size;
                }
            }
        } catch (err) {
            console.error('Error checking logs:', err);
        }
        
        // Compile all information
        const systemInfo = {
            // System
            hostname,
            platform,
            osVersion,
            kernel: `${platform} ${osVersion}`,
            arch,
            uptime,
            nodeVersion: process.version,
            
            // Resources
            memory: {
                total: totalMem,
                used: usedMem,
                free: freeMem
            },
            disk: diskInfo,
            cpu: {
                cores: cpuCores,
                model: os.cpus()[0]?.model || 'Unknown'
            },
            loadAvg,
            
            // Network
            network: {
                ips,
                hostname
            },
            
            // Application
            app: {
                version: appVersion,
                path: process.cwd()
            },
            pm2: pm2Info,
            
            // Services & Ports
            ports: {
                smtp: process.env.SMTP_PORT || 25,
                api: process.env.PORT || 3001,
                dashboard: process.env.PORT || 3001
            },
            services: {
                smtp: pm2Info.status === 'online' ? 'running' : 'stopped',
                api: 'running', // If we're responding, API is running
                dashboard: 'running'
            },
            
            // Security & Config
            exchange: exchangeInfo,
            tls: tlsInfo,
            security: {
                ipWhitelist: ipWhitelistInfo.enabled,
                ipWhitelistCount: ipWhitelistInfo.count,
                mfa: mfaEnabled
            },
            queue: {
                count: queueCount
            },
            logs: {
                size: logSize
            }
        };
        
        res.json(systemInfo);
    } catch (error) {
        console.error('Error getting system info:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve system information',
            details: error.message 
        });
    }
});

// Get system health check
router.get('/health', authenticate, async (req, res) => {
    try {
        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
        const loadAvg = os.loadavg()[0]; // 1 minute load average
        const cpuCount = os.cpus().length;
        
        const health = {
            status: 'healthy',
            memory: {
                usage: memoryUsage.toFixed(2) + '%',
                status: memoryUsage > 90 ? 'critical' : memoryUsage > 70 ? 'warning' : 'healthy'
            },
            cpu: {
                loadAvg: loadAvg.toFixed(2),
                status: loadAvg > cpuCount * 0.8 ? 'warning' : 'healthy'
            },
            uptime: os.uptime(),
            timestamp: new Date().toISOString()
        };
        
        // Overall health status
        if (health.memory.status === 'critical' || health.cpu.status === 'critical') {
            health.status = 'critical';
        } else if (health.memory.status === 'warning' || health.cpu.status === 'warning') {
            health.status = 'warning';
        }
        
        res.json(health);
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            error: 'Failed to get health status',
            details: error.message 
        });
    }
});

module.exports = router;