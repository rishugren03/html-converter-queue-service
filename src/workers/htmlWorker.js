const { Worker } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { sendMessageToClients } = require("../config/web-scket");
const { convertHTML } = require("../services/universal-converter/index");
const puppeteer = require("puppeteer");

let browser = null; // Store Puppeteer instance globally
let jobCount = 0; // Track processed jobs
const MAX_JOBS_BEFORE_RESTART = 50; // Change this as needed

async function getBrowser() {
  if (!browser) {
    console.log("🚀 Launching new Puppeteer instance...");
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

const htmlWorker = new Worker(
  "htmlQueue",
  async (job) => {
    console.log(`📥 Processing job ${job.id}`);
    sendMessageToClients({ jobId: job.id, status: "processing" });

    const { html, type } = job.data;

    try {
      const browserInstance = await getBrowser();
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

      sendMessageToClients(data, true);

      console.log(`✅ Job ${job.id} completed successfully`);

      // Track job count
      jobCount++;

      // Close browser if job limit reached
      if (jobCount >= MAX_JOBS_BEFORE_RESTART) {
        console.log(
          "♻️ Restarting Puppeteer after processing multiple jobs..."
        );
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
