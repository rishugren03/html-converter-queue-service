const { Redis } = require("ioredis");

const redisConnection = new Redis({
  host: "0.0.0.0",
  port: 6379,
//  password: "devris-converter-saas"
 //retryStrategy: (times) => Math.min(times * 50, 2000),
 maxRetriesPerRequest: null,
 // enableReadyCheck: false,
});

redisConnection.on("connect", () => {
  console.log("✅ Connected to Redis successfully!");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err);
});

module.exports = { redisConnection };
