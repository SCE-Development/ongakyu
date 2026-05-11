module.exports = {
  apps: [
    {
      name: "ongakyu-backend",
      script: "backend/dist/index.js",
      cwd: "/home/ubuntu/websites/ongakyu",
      interpreter: "/home/ubuntu/.nvm/versions/node/v20.20.1/bin/node",
      kill_timeout: 3000,
      restart_delay: 3000,
      max_restarts: 5,
      env: {
        NODE_ENV: "production",
        PORT: 3003,
      },
    },
  ],
};
