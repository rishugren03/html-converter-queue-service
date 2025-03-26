const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");

const urlQueue = new Queue("urlQueue", {
  connection: redisConnection,
});

module.exports = { urlQueue };
