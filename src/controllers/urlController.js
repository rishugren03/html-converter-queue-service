const { urlQueue } = require("../queues/urlQueue");

const addUrlToQueue = async (req, res) => {
  const { url, type } = req.body;
  const apiKey = req.headers["x-api-key"];

  if (
    !url ||
    typeof url !== "string" ||
    !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(url)
  ) {
    return res.status(400).json({ error: "A valid URL is required" });
  }

  try {
    const job = await urlQueue.add(
      "urlJob",
      { url, apiKey, type },
      { attempts: 3 }
    );
    res.json({ message: "Job added to queue", jobId: job.id });
  } catch (error) {
    console.error("❌ Error adding job to queue:", error);
    res.status(500).json({ error: "Failed to add job to queue" });
  }
};

module.exports = { addUrlToQueue };
