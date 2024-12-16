module.exports = {
  apps: [
    {
      script: './dist/main.js',
      name: 'prod-alexa-gpt',
      exec_mode: 'cluster',
      instances: '1',
      env: {
        NODE_ENV: 'prod'
      }
    }
  ]
};
