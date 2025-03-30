const { Queue } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");

const urlQueue = new Queue("urlQueue", {
  connection: redisConnection,

  // Rate limit: Prevents too many jobs from overloading the system
  limiter: {
    max: 100,
    duration: 1000,
  },

  // Default job options
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Handle Redis connection errors
urlQueue.on("error", (err) => {
  console.error("🚨 URL Queue Error:", err.message);
});

console.log("✅ URL Queue initialized successfully");

module.exports = { urlQueue };
