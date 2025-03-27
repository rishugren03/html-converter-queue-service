const { Worker } = require("bullmq");
const axios = require("axios");
const { redisConnection } = require("../config/redisConfig");
const { sendMessageToClients } = require("../config/web-scket");

const htmlWorker = new Worker(
  "htmlQueue",
  async (job) => {
    try {
      console.log(`📥 Processing job ${job.id}`);
      sendMessageToClients({ jobId: job.id, status: "processing" });

      const { html, apiKey, type } = job.data;

      // Send request to conversion system
      const response = await axios.post(
        "http://localhost:7000/api/v1/convert/html",
        { html, type },
        {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      // console.log(response.data);
      const buffer = response.data.data;
      // Send the buffer as a response via WebSocket
      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        data: buffer,
      });

      // Log the buffer details
      console.log(`✅ Job ${job.id} completed successfully`);

      return { success: true, data: buffer };
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error.message);
      sendMessageToClients({
        jobId: job.id,
        status: "failed",
        error: error.message,
      });

      throw error;
    }
  },
  { connection: redisConnection }
);

module.exports = { htmlWorker };
