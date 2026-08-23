// PM2 process list — app (Next.js) + worker (pipeline)
// App: Next.js auto-loads /opt/nology/.env.production itself.
// Worker: Node 20 loads it via --env-file.
module.exports = {
  apps: [
    {
      name: 'nology-app',
      cwd: '/opt/nology',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      max_memory_restart: '1500M',
      time: true,
    },
    {
      name: 'nology-worker',
      cwd: '/opt/nology',
      script: 'worker/worker.mjs',
      node_args: '--env-file=/opt/nology/.env.production',
      max_memory_restart: '4000M',
      time: true,
    },
  ],
}
