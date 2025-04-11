const fs = require("fs");
const path = require("path");
const { Worker } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { sendMessageToClients } = require("../config/web-scket");
const { convertHTML } = require("../services/universal-converter/index");
const puppeteer = require("puppeteer");

// Read Lua script from file
const luaScript = fs.readFileSync(
  path.join(__dirname, "../scripts/update_usage.lua"),
  "utf8"
);

let browser = null;
let jobCount = 0;
const MAX_JOBS_BEFORE_RESTART = 50;

// Timeout wrapper
function withTimeout(promise, timeout = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Puppeteer timeout")), timeout)
    ),
  ]);
}

async function getBrowser() {
  if (!browser) {
    console.log("🚀 Launching new Puppeteer instance...");
    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Optional: Listen for crashes
    browser.on("disconnected", () => {
      console.warn("💥 Puppeteer browser crashed! Resetting...");
      browser = null;
    });
  }
  return browser;
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

    if (!apiKey) {
      const errMsg = "API key missing";
      console.error(`❌ Job ${job.id} failed: ${errMsg}`);
      sendMessageToClients({ jobId: job.id, status: "failed", error: errMsg });
      return { success: false, error: errMsg };
    }

    try {
      const browserInstance = await getBrowser();
      sendMessageToClients({ jobId: job.id, status: "processing" });

      const { data, mimeType, extension } = await withTimeout(
        convertHTML(html, type, browserInstance),
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

      jobCount++;
      if (jobCount >= MAX_JOBS_BEFORE_RESTART) {
        console.log("♻️ Restarting Puppeteer after max jobs...");
        try {
          await browser.close();
        } catch (closeErr) {
          console.warn("⚠️ Error while closing browser:", closeErr.message);
        } finally {
          browser = null;
          jobCount = 0;
        }
      }

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
    // Removed concurrency to test with 1 job at a time
    limiter: { max: 50, duration: 3500 },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  }
);

console.log("✅ HTML Worker initialized");
module.exports = { htmlWorker };
