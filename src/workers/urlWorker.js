const { Worker } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { sendMessageToClients } = require("../config/web-scket");
const { convertURL } = require("../services/universal-converter/index"); // Import function

const urlWorker = new Worker(
  "urlQueue",
  async (job) => {
    console.log(`📥 Processing job ${job.id}`);
    sendMessageToClients({ jobId: job.id, status: "processing" });

    const { url, type } = job.data;

    try {
      // Call function directly instead of making an API request
      const { data, mimeType, extension } = await convertURL(url, type);

      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        data, // Send file buffer
        mimeType,
        extension,
      });

      console.log(`✅ Job ${job.id} completed successfully`);
      return { success: true, data };
    } catch (error) {
      console.error(`❌ Job ${job.id} failed: ${error.message}`);

      try {
        sendMessageToClients({
          jobId: job.id,
          status: "failed",
          error: error.message,
        });
      } catch (wsError) {
        console.error(
          `⚠️ WebSocket error for job ${job.id}: ${wsError.message}`
        );
      }

      throw error; // BullMQ will retry if configured
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: { max: 50, duration: 1000 },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  }
);

console.log("✅ URL Worker initialized successfully");
module.exports = { urlWorker };
