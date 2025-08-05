const { Redis } = require("ioredis");

const redisConnection = new Redis({
  host: "0.0.0.0",
  port: 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redisConnection.on("connect", () => {
  console.log("✅ Connected to Redis successfully!");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔌 Closing Redis connection...");
  await redisConnection.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🔌 Closing Redis connection...");
  await redisConnection.quit();
  process.exit(0);
});

module.exports = { redisConnection };
