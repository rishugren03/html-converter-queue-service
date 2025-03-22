const { Worker } = require("bullmq");
const axios = require("axios");
const { redisConnection } = require("../config/redisConfig");

const pdfWorker = new Worker(
  "pdfQueue",
  async (job) => {
    try {
      console.log(`📥 Processing job ${job.id}`);

      const { html, apiKey } = job.data;

      // Request conversion from the conversion system (Same as Web2DocxClient)
      const response = await axios.post(
        "http://localhost:7000/api/v1/convert/html-pdf",
        { html },
        {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer", // ✅ Exactly the same as Web2DocxClient
        }
      );

      console.log(`✅ Job ${job.id} completed successfully`);
      return response.data;
    } catch (error) {
      console.log(error.response);
      console.error(`❌ Job ${job.id} failed:`, error.message);
      throw new Error(error.response?.data?.error || "API request failed");
    }
  },
  { connection: redisConnection } // ✅ Fixed Redis Connection
);

// Listen for completion
pdfWorker.on("completed", (job) => {
  console.log(`🎉 Job ${job.id} finished successfully`);
});

// Listen for failures
pdfWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed with error: ${err.message}`);
});

module.exports = { pdfWorker };
