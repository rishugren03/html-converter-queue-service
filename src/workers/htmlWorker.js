const fs = require("fs");
const path = require("path");
const { Worker } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { sendMessageToClients } = require("../config/web-scket");
const { convertHTML } = require("../services/universal-converter/index");
const puppeteer = require("puppeteer");
const GenericPool = require("generic-pool"); // Add this import

// Read Lua script from file
const luaScript = fs.readFileSync(
  path.join(__dirname, "../scripts/update_usage.lua"),
  "utf8"
);

// Browser pool configuration
const browserPool = GenericPool.createPool(
  {
    create: async () => {
      console.log("🚀 Creating new browser instance");
      return await puppeteer.launch({
        headless: "new",
        executablePath: puppeteer.executablePath(),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          // "--disable-dev-shm-usage", // Important for Docker
          "--disable-gpu",
          "--single-process",
        ],
      });
    },
    destroy: async (browser) => {
      console.log("🔌 Closing browser instance");
      await browser.close();
    },
    validate: async (browser) => {
      try {
        // Test if browser is still healthy
        const version = await browser.version();
        return !!version;
      } catch (e) {
        return false;
      }
    },
  },
  {
    min: 1,
    max: 5,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 300000,
    evictionRunIntervalMillis: 60000,
  }
);

// Timeout wrapper
function withTimeout(promise, timeout = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Puppeteer timeout")), timeout)
    ),
  ]);
}

async function updateUsageCount(apiKey) {
  const [success, updatedUsage] = await redisConnection.eval(
    luaScript,
    2,
    `api_key:${apiKey}`, // KEYS[1]
    `api_usage:${apiKey}` // KEYS[2]
  );

  if (!success) throw new Error("Redis update failed");

  console.log(`🔄 Updated usage count: ${updatedUsage}`);
  return updatedUsage;
}

const htmlWorker = new Worker(
  "htmlQueue",
  async (job) => {
    const { html, type, apiKey } = job.data;
    console.log(`📥 Processing job ${job.id}`);
    let browser, page;

    if (!apiKey) {
      const errMsg = "API key missing";
      console.error(`❌ Job ${job.id} failed: ${errMsg}`);
      sendMessageToClients({ jobId: job.id, status: "failed", error: errMsg });
      return { success: false, error: errMsg };
    }

    try {
      // Acquire browser from pool
      browser = await browserPool.acquire();
      sendMessageToClients({ jobId: job.id, status: "processing" });

      const { data, mimeType, extension } = await withTimeout(
        convertHTML(html, type, browser),
        30000
      );

      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        mimeType,
        extension,
        data: data.toString("base64"),
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
    } finally {
      // Always release the browser back to the pool
      if (browser) {
        await browserPool.release(browser).catch((err) => {
          console.error("Error releasing browser:", err);
          // If release fails, destroy the browser to keep pool clean
          browserPool.destroy(browser);
        });
      }
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

// Cleanup on process exit
process.on("beforeExit", async () => {
  await browserPool.drain();
  await browserPool.clear();
});

console.log("✅ HTML Worker initialized with browser pooling");
module.exports = { htmlWorker };
