const { urlQueue } = require("../queues/urlQueue");

const addUrlToQueue = async (req, res) => {
  try {
    const { url, type } = req.body;
    const apiKey = req.headers["x-api-key"];

    // Validate API Key
    if (!apiKey) {
      console.warn("⚠️ Missing API Key in request headers");
      return res.status(401).json({ error: "API Key is required" });
    }

    // Validate URL format
    const urlRegex = /^(https?:\/\/)(www\.)?[^\s$.?#].[^\s]*$/;
    if (!url || typeof url !== "string" || !urlRegex.test(url.trim())) {
      return res.status(400).json({ error: "A valid URL is required" });
    }

    // Prevent Queue Overload (Example: Limit waiting jobs to 10,000)
    const jobCount = await urlQueue.getJobCounts();
    if (jobCount.waiting >= 10000) {
      console.error("🚨 Queue overloaded! Too many jobs waiting.");
      return res
        .status(503)
        .json({ error: "Service temporarily unavailable. Try again later." });
    }

    // Add job to queue with retries
    const job = await urlQueue.add(
      "urlJob",
      { url, apiKey, type },
      {
        attempts: 3, // Retries if processing fails
        removeOnComplete: true, // Clean up successful jobs
        removeOnFail: false, // Keep failed jobs for debugging
      }
    );

    console.info(`✅ Job ${job.id} added to URL queue successfully.`);
    res.status(202).json({ message: "Job added to queue", jobId: job.id });
  } catch (error) {
    console.error("❌ Error adding job to queue:", error.message || error);
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

module.exports = { addUrlToQueue };
