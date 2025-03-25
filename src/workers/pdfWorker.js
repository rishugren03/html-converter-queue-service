const { Worker } = require("bullmq");
const axios = require("axios");
const { redisConnection } = require("../config/redisConfig");
const { sendMessageToClients } = require("../config/web-scket");

const pdfWorker = new Worker(
  "pdfQueue",
  async (job) => {
    try {
      console.log(`📥 Processing job ${job.id}`);
      sendMessageToClients({ jobId: job.id, status: "processing" });

      const { html, apiKey } = job.data;

      // Send request to conversion system
      const response = await axios.post(
        "http://localhost:7000/api/v1/convert/html-pdf",
        { html },
        {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
        }
      );

      console.log(`✅ Job ${job.id} completed successfully`);

      // Send completed PDF data via WebSocket
      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        pdf: Buffer.from(response.data).toString("base64"), // ✅ Convert buffer to base64
      });

      return response.data;
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

module.exports = { pdfWorker };
