/**
 * PM2 Production Configuration for NOLOGY
 * ============================================================
 * Web: Next.js (Node.js runtime) — serves API + Dashboard + static export
 * Worker: Video processing pipeline — long-running, CPU/GPU intensive
 * 
 * Both processes load /opt/nology/.env.production via --env-file
 * 
 * Production requirements:
 * - Graceful shutdown on SIGTERM/SIGINT (drain in-flight requests)
 * - Automatic restart on crash with exponential backoff
 * - Log rotation via pm2-logrotate
 * - Health checks via HTTP endpoints
 * - Memory limits with auto-restart
 * - Zero-downtime reload for web app
 * - Worker: max_memory_restart 4G (FFmpeg/InsightFace heavy)
 */

module.exports = {
  apps: [
    {
      name: 'nology-web',
      cwd: '/opt/nology',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      // Graceful shutdown: allow 30s for in-flight requests to complete
      kill_timeout: 30000,
      // Wait for connections to drain before killing
      wait_ready: true,
      listen_timeout: 30000,
      // Memory limit with auto-restart (Next.js can be memory-hungry)
      max_memory_restart: '1500M',
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      // Zero-downtime reload
      reload_signal: 'SIGUSR2',
      // Logs
      time: true,
      timestamp: true,
      output: '/var/log/nology/web-out.log',
      error: '/var/log/nology/web-err.log',
      // Env
      env_file: '/opt/nology/.env.production',
      // Health check
      // PM2 will consider the app ready when it can connect to port 3000
      // We also have /api/health endpoint
    },
    {
      name: 'nology-worker',
      cwd: '/opt/nology',
      script: 'worker/worker.mjs',
      node_args: '--env-file=/opt/nology/.env.production',
      // Worker needs more time for graceful shutdown (FFmpeg renders)
      kill_timeout: 120000,
      // Memory limit: worker uses FFmpeg + InsightFace (heavy)
      max_memory_restart: '4000M',
      // Restart policy: more aggressive for worker (crashes are common with FFmpeg)
      autorestart: true,
      max_restarts: 15,
      min_uptime: '60s',
      restart_delay: 5000,
      // Logs
      time: true,
      timestamp: true,
      output: '/var/log/nology/worker-out.log',
      error: '/var/log/nology/worker-err.log',
      // Env
      env_file: '/opt/nology/.env.production',
      // Worker-specific env
      env: {
        NODE_ENV: 'production',
        UV_THREADPOOL_SIZE: '16',
      },
    },
  ],
  
  // PM2 deploy configuration (for zero-downtime deployments)
  deploy: {
    production: {
      user: 'root',
      host: ['<VPS_IP>'],
      ref: 'origin/main',
      repo: 'https://github.com/Abbdelraheem/cliptica.git',
      path: '/opt/nology',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --silent && npx prisma generate && npm run build && pm2 reload nology-web --update-env && pm2 restart nology-worker --update-env',
      'pre-setup': '',
    },
  },
};