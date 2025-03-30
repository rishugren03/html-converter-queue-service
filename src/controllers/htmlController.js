const { htmlQueue } = require("../queues/htmlQueue");

const addHtmlToQueue = async (req, res) => {
  try {
    const { html, type } = req.body;
    const apiKey = req.headers["x-api-key"];

    // Validate API Key
    if (!apiKey) {
      console.warn("⚠️ Missing API Key in request headers");
      return res.status(401).json({ error: "API Key is required" });
    }

    // Validate HTML input
    if (!html || typeof html !== "string" || html.trim() === "") {
      return res.status(400).json({ error: "Valid HTML content is required" });
    }

    // Optional: Limit queue size to prevent overload (Example: 10,000 jobs max)
    const jobCount = await htmlQueue.getJobCounts();
    if (jobCount.waiting >= 10000) {
      console.error("🚨 Queue overloaded! Too many jobs waiting.");
      return res
        .status(503)
        .json({ error: "Service temporarily unavailable. Try again later." });
    }

    // Add job to queue with retries
    const job = await htmlQueue.add(
      "htmlJob",
      { html, apiKey, type },
      {
        attempts: 3, // Retries in case of failure
        removeOnComplete: true, // Remove from queue when done
        removeOnFail: false, // Keep failed jobs for debugging
      }
    );

    console.info(`✅ Job ${job.id} added to queue successfully.`);
    res.status(202).json({ message: "Job added to queue", jobId: job.id });
  } catch (error) {
    console.error("❌ Error adding job to queue:", error.message || error);
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

module.exports = { addHtmlToQueue };
