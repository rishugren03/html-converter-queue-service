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

async function getBrowser() {
  if (!browser) {
    console.log("🚀 Launching new Puppeteer instance...");
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

// Function to update usage count using Lua
async function updateUsageCount(apiKey) {
  const [success, updatedUsage] = await redisConnection.eval(
    luaScript,
    2,
    `api_key:${apiKey}`, // KEYS[1]
    `api_usage:${apiKey}` // KEYS[2]
  );

  if (!success) {
    throw new Error("Redis update failed");
  }

  console.log(`🔄 Updated usage count in Redis: ${updatedUsage}`);
  return updatedUsage;
}

const htmlWorker = new Worker(
  "htmlQueue",
  async (job) => {
    console.log(`📥 Processing job ${job.id}`);

    const { html, type, apiKey } = job.data;
    if (!apiKey) {
      console.error("❌ Job failed: API key is missing");
      sendMessageToClients({
        jobId: job.id,
        status: "failed",
        error: "API key missing",
      });
      return { success: false, error: "API key missing" };
    }

    try {
      // 🔹 Process the job with Puppeteer
      const browserInstance = await getBrowser();
      sendMessageToClients({ jobId: job.id, status: "processing" });

      const { data, mimeType, extension } = await convertHTML(
        html,
        type,
        browserInstance
      );

      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        mimeType,
        extension,
        data: data.toString("base64"),
      });

      console.log(`✅ Job ${job.id} completed successfully`);

      // 🔹 **Atomic usage count update using Lua**
      await updateUsageCount(apiKey);

      // 🔹 Restart Puppeteer if needed
      jobCount++;
      if (jobCount >= MAX_JOBS_BEFORE_RESTART) {
        console.log("♻️ Restarting Puppeteer after multiple jobs...");
        await browser.close();
        browser = null;
        jobCount = 0;
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ Job ${job.id} failed: ${error.message}`);
      sendMessageToClients({
        jobId: job.id,
        status: "failed",
        error: error.message,
      });
      throw error;
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

console.log("✅ HTML Worker initialized successfully");
module.exports = { htmlWorker };
