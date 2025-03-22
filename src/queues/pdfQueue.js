const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");

const pdfQueue = new Queue("pdfQueue", {
  connection: redisConnection,
});

module.exports = { pdfQueue };
