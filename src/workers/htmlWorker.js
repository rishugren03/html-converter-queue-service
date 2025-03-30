const { Worker } = require("bullmq");
const axios = require("axios");
const fs = require("fs"); // Required for saving the buffer to a file
const { redisConnection } = require("../config/redisConfig");
const { sendMessageToClients } = require("../config/web-scket");

const htmlWorker = new Worker(
  "htmlQueue",
  async (job) => {
    console.log(`📥 Processing job ${job.id}`);
    sendMessageToClients({ jobId: job.id, status: "processing" });

    const { html, apiKey, type } = job.data;

    try {
      const response = await axios.post(
        "http://localhost:7000/api/v1/convert/html",
        { html, type },
        {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer", // Ensures binary response
          timeout: 10000,
        }
      );

      if (!response.data) {
        throw new Error("Invalid response from conversion system");
      }

      const fileBuffer = response.data;

      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        data: fileBuffer,
      });

      console.log(`✅ Job ${job.id} completed successfully`);
      return { success: true, data: fileBuffer };
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

console.log("✅ HTML Worker initialized successfully");
module.exports = { htmlWorker };
