const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");

const htmlQueue = new Queue("htmlQueue", {
  connection: redisConnection,
});

module.exports = { htmlQueue };
