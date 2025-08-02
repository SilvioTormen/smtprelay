module.exports = {
  apps: [{
    name: 'smtp-relay',
    script: './src/index.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Restart settings
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Resource limits
    max_memory_restart: '500M',
    
    // Environment
    env: {
      NODE_ENV: 'production'
    },
    
    // Logging
    error_file: '/var/log/smtp-relay/pm2-error.log',
    out_file: '/var/log/smtp-relay/pm2-out.log',
    log_file: '/var/log/smtp-relay/pm2-combined.log',
    time: true,
    merge_logs: true,
    
    // Advanced
    kill_timeout: 5000,
    listen_timeout: 10000,
    
    // Monitoring
    instance_var: 'INSTANCE_ID',
    
    // Graceful shutdown
    wait_ready: true,
    stop_exit_codes: [0]
  }]
};