const { htmlQueue } = require("../queues/htmlQueue");
const { htmlBatchQueue } = require("../queues/htmlBatchQueue");

const addHtmlToQueue = async (req, res) => {
  try {
    const { html, htmlList, type } = req.body;
    const apiKey = req.headers["x-api-key"];
    const user = req.apiUser;

    // Validate API Key
    if (!apiKey) {
      console.warn("⚠️ Missing API Key in request headers");
      return res.status(401).json({ error: "API Key is required" });
    }

    // Validate input based on type (batch or single)
    const isBatch = Array.isArray(htmlList);

    if (isBatch) {
      if (!htmlList.length) {
        return res.status(400).json({ error: "htmlList cannot be empty" });
      }
      if (htmlList.length > 10) {
        return res
          .status(413)
          .json({
            error: "Batch limit exceeded. Maximum 10 HTML documents allowed.",
          });
      }
    } else {
      if (!html || typeof html !== "string" || html.trim() === "") {
        return res
          .status(400)
          .json({ error: "Valid HTML content is required" });
      }
    }

    // Choose correct queue
    const queue = isBatch ? htmlBatchQueue : htmlQueue;

    // Optional: Limit queue size to prevent overload
    const jobCount = await queue.getJobCounts();
    if (jobCount.waiting >= 10000) {
      console.error("🚨 Queue overloaded! Too many jobs waiting.");
      return res
        .status(503)
        .json({ error: "Service temporarily unavailable. Try again later." });
    }

    // Determine priority based on user plan
    let priority = 5;
    let queueType = "free";

    if (user && user.plan) {
      if (user.plan === "pro_max") {
        priority = 1;
        queueType = "pro_max";
      } else if (user.plan === "pro") {
        priority = 3;
        queueType = "pro";
      }
    }

    // If it's a batch job, only allow pro_max users
    // if (isBatch && user.plan !== "pro_max") {
    //   console.warn(
    //     "❌ Batch processing denied: User is not a Pro Max subscriber"
    //   );
    //   return res.status(403).json({
    //     error: "Batch processing is available for Pro Max users only",
    //   });
    // }

    // Add job to the correct queue
    const job = await queue.add(
      isBatch ? "html-batch" : "htmlJob",
      {
        html: isBatch ? undefined : html,
        htmlList: isBatch ? htmlList : undefined,
        apiKey,
        type,
        plan: user.plan,
        userId: user.userId,
      },
      {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
        priority: priority,
      }
    );

    console.info(
      `✅ Job ${job.id} added to ${
        isBatch ? "BATCH" : "SINGLE"
      } queue successfully with priority ${priority} (${queueType})`
    );
    res.status(202).json({
      message: "Job added to queue",
      jobId: job.id,
      queueType: queueType,
    });
  } catch (error) {
    console.error("❌ Error adding job to queue:", error.message || error);
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

module.exports = { addHtmlToQueue };
