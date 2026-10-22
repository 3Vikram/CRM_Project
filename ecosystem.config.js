module.exports = {
  apps: [
    {
      name: 'inventory-backend',
      script: 'src/server.js',
      cwd: require('node:path').resolve(__dirname, 'inventory/backend'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'sales-backend',
      script: 'server.js',
      cwd: require('node:path').resolve(__dirname, 'sales/backend'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      watch: false,
    },
  ],
}
