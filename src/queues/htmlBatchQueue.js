const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");

const htmlBatchQueue = new Queue("htmlBatchQueue", {
  connection: redisConnection,

  // Batch jobs are heavier, so slower rate limit
  limiter: {
    max: 20, // Allow fewer batch jobs per second
    duration: 1000,
  },

  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 }, // Longer backoff for heavy jobs
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 180000, // 3 min timeout for batch jobs
  },
});

// Handle Redis Connection Errors Gracefully
htmlBatchQueue.on("error", (err) => {
  console.error("🚨 HTML BATCH Queue Error:", err.message);
});

console.log("✅ HTML BATCH Queue initialized successfully");

module.exports = { htmlBatchQueue };
