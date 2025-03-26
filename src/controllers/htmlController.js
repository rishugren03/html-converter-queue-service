const { htmlQueue } = require("../queues/htmlQueue");

const addHtmlToQueue = async (req, res) => {
  const { html, type } = req.body;
  const apiKey = req.headers["x-api-key"];

  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Valid HTML content is required" });
  }

  try {
    const job = await htmlQueue.add(
      "htmlJob",
      { html, apiKey, type },
      { attempts: 3 }
    );
    res.json({ message: "Job added to queue", jobId: job.id });
  } catch (error) {
    console.error("❌ Error adding job to queue:", error);
    res.status(500).json({ error: "Failed to add job to queue" });
  }
};

module.exports = { addHtmlToQueue };
