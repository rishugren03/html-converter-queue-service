module.exports = {
  apps: [
    {
      name: "queue-service",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
    }
  ]
};
