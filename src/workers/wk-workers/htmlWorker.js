const fs = require("fs");
const path = require("path");
const { Worker } = require("bullmq");
const { redisConnection } = require("../../config/redisConfig");
const { sendMessageToClients } = require("../../config/web-scket");
// const { htmlToPdf } = require("../../../../new-conversion-system/index");
const {
  htmlUnivConverter,
} = require("../../services/new-conversion-service/index");
const getConvQualitySettings = require("../helper");

// Read Lua script from file
const luaScript = fs.readFileSync(
  path.join(__dirname, "../../scripts/update_usage.lua"),
  "utf8"
);

async function updateUsageCount(apiKey, incrementBy = 1) {
  const [success, updatedUsage] = await redisConnection.eval(
    luaScript,
    2,
    `api_key:${apiKey}`,
    `api_usage:${apiKey}`,
    incrementBy.toString()
  );

  if (!success) throw new Error("Redis update failed");

  console.log(`🔄 Updated usage count: ${updatedUsage}`);
  return updatedUsage;
}

const htmlWorker = new Worker(
  "htmlQueue",
  async (job) => {
    const { html, type, apiKey, plan } = job.data;

    console.log(`📥 Processing job ${job.id}`);

    if (!apiKey) {
      const errMsg = "API key missing";
      console.error(`❌ Job ${job.id} failed: ${errMsg}`);
      sendMessageToClients({ jobId: job.id, status: "failed", error: errMsg });
      return { success: false, error: errMsg };
    }

    try {
      sendMessageToClients({ jobId: job.id, status: "processing" });

      const qualitySettings = getConvQualitySettings(plan);
      const { buffer, mimeType, extension } = await htmlUnivConverter(
        type,
        html,
        qualitySettings
      );

      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        mimeType,
        extension,
        data: buffer.toString("base64"),
      });

      console.log(`✅ Job ${job.id} completed successfully`);
      await updateUsageCount(apiKey);

      const usage = process.memoryUsage();
      console.log(
        `📊 Mem: RSS=${(usage.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(
          usage.heapUsed /
          1024 /
          1024
        ).toFixed(2)}MB`
      );

      return { success: true };
    } catch (error) {
      console.error(`❌ Job ${job.id} failed: ${error.message}`);
      sendMessageToClients({
        jobId: job.id,
        status: "failed",
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: { max: 50, duration: 3500 },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  }
);

// Handle worker events
htmlWorker.on("failed", (job, err) => {
  console.error(
    `❌ HTML Worker job ${job.id} failed with error: ${err.message}`
  );
  console.log(err);
});

htmlWorker.on("completed", (job) => {
  console.log(`✓ HTML Worker job ${job.id} completed`);
});

htmlWorker.on("error", (err) => {
  console.error("❌ HTML Worker error:", err);
  console.log(err);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔌 Closing HTML Worker...");
  await htmlWorker.close();
});

process.on("SIGTERM", async () => {
  console.log("🔌 Closing HTML Worker...");
  await htmlWorker.close();
});

console.log("✅ HTML Worker initialized with new-conversion-service");

module.exports = { htmlWorker };
