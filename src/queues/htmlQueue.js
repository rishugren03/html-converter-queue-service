const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");

const htmlQueue = new Queue("htmlQueue", {
  connection: redisConnection,

  // Limits how many jobs can be added per second (rate limiting)
  limiter: {
    max: 100,
    duration: 1000,
  },

  // Default options for each job added
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Handle Redis Connection Errors Gracefully
htmlQueue.on("error", (err) => {
  console.error("🚨 HTML Queue Error:", err.message);
});

console.log("✅ HTML Queue initialized successfully");

module.exports = { htmlQueue };
