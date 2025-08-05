const fs = require("fs");
const path = require("path");
const { Worker } = require("bullmq");
const archiver = require("archiver");
const { PassThrough } = require("stream");
const { redisConnection } = require("../../config/redisConfig");
const { sendMessageToClients } = require("../../config/web-scket");
const {
  htmlUnivConverter,
} = require("../../services/new-conversion-service/index");
const getConvQualitySettings = require("../helper");

// Read Lua script
const luaScript = fs.readFileSync(
  path.join(__dirname, "../../scripts/update_usage.lua"),
  "utf8"
);

async function updateUsageCount(apiKey, incrementBy = 1) {
  const [success, updatedUsage] = await redisConnection.eval(
    luaScript,
    2,
    `api_key:${apiKey}`,
    `api_usage:${apiKey}`,
    incrementBy.toString()
  );
  if (!success) throw new Error("Redis update failed");
  console.log(`🔄 Updated usage count: ${updatedUsage}`);
  return updatedUsage;
}

const htmlBatchWorker = new Worker(
  "htmlBatchQueue",
  async (job) => {
    const { htmlList, type, apiKey, plan } = job.data;
    console.log(`📥 Processing BATCH job ${job.id}`);

    if (!apiKey) {
      const errMsg = "API key missing";
      console.error(`❌ BATCH Job ${job.id} failed: ${errMsg}`);
      sendMessageToClients({ jobId: job.id, status: "failed", error: errMsg });
      return { success: false, error: errMsg };
    }

    if (!Array.isArray(htmlList) || htmlList.length === 0) {
      const errMsg = "htmlList is empty or invalid";
      console.error(`❌ BATCH Job ${job.id} failed: ${errMsg}`);
      sendMessageToClients({ jobId: job.id, status: "failed", error: errMsg });
      return { success: false, error: errMsg };
    }

    try {
      sendMessageToClients({
        jobId: job.id,
        status: "processing",
        message: `Processing ${htmlList.length} files`,
      });

      // Setup archive in memory with proper event handling and memory management
      const archiveStream = new PassThrough();
      const archiveBuffers = [];
      let totalSize = 0;
      const MAX_MEMORY_SIZE = 100 * 1024 * 1024; // 100MB limit

      archiveStream.on("data", (chunk) => {
        totalSize += chunk.length;
        if (totalSize > MAX_MEMORY_SIZE) {
          throw new Error("Archive size exceeds memory limit");
        }
        archiveBuffers.push(chunk);
      });

      const archive = archiver("zip", {
        zlib: { level: 6 }, // Reduced compression for better performance
        store: false,
      });

      // Set up proper promise to wait for archiving to complete
      const archiveFinished = new Promise((resolve, reject) => {
        let isResolved = false;

        archive.on("warning", (err) => {
          console.warn(`⚠️ BATCH Job ${job.id} archive warning:`, err);
          // Only reject on serious errors
          if (err.code === "ENOENT" && !isResolved) {
            isResolved = true;
            reject(err);
          }
        });

        archive.on("error", (err) => {
          console.error(`❌ BATCH Job ${job.id} archive error:`, err);
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
        });

        archive.on("finish", () => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        });

        // Timeout safety
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error("Archive timeout"));
          }
        }, 90000); // 90 second timeout
      });

      archive.pipe(archiveStream);

      // Process files with progress updates
      const totalFiles = htmlList.length;
      let processedFiles = 0;

      for (let i = 0; i < totalFiles; i++) {
        const html = htmlList[i];

        try {
          // Update progress every few files
          if (i % 5 === 0 || i === totalFiles - 1) {
            sendMessageToClients({
              jobId: job.id,
              status: "processing",
              progress: Math.round((i / totalFiles) * 100),
              message: `Converted ${i}/${totalFiles} files`,
            });
          }

          const qualitySettings = getConvQualitySettings(plan);

          // Add timeout wrapper for individual conversions
          const conversionPromise = htmlUnivConverter(
            type,
            html,
            qualitySettings
          );
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Conversion timeout")), 30000)
          );

          const { buffer, extension } = await Promise.race([
            conversionPromise,
            timeoutPromise,
          ]);
          archive.append(buffer, { name: `document_${i + 1}.${extension}` });
          processedFiles++;
        } catch (conversionError) {
          console.error(
            `⚠️ Error converting document ${i + 1}:`,
            conversionError.message
          );
          // Add error note instead of the file
          archive.append(
            `Error converting this document: ${conversionError.message}`,
            { name: `document_${i + 1}_ERROR.txt` }
          );
        }
      }

      // Finalize the archive - this is when data actually gets pushed through the pipe
      await archive.finalize();

      // Wait for archiving to fully complete
      await archiveFinished;

      // Combine all buffers into final ZIP file
      const finalZipBuffer = Buffer.concat(archiveBuffers);

      // Clean up memory
      archiveBuffers.length = 0;

      // Send the completed archive back to client
      sendMessageToClients({
        jobId: job.id,
        status: "completed",
        mimeType: "application/zip",
        extension: "zip",
        data: finalZipBuffer.toString("base64"),
        message: `Successfully processed ${processedFiles} of ${totalFiles} files`,
      });

      console.log(
        `✅ BATCH Job ${job.id} completed successfully with ${processedFiles}/${totalFiles} files`
      );

      // Update usage count (by number of files successfully processed)
      await updateUsageCount(apiKey, processedFiles);

      // Log memory usage
      const usage = process.memoryUsage();
      console.log(
        `📊 BATCH Job ${job.id} Mem: RSS=${(usage.rss / 1024 / 1024).toFixed(
          2
        )}MB, Heap=${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`
      );

      return {
        success: true,
        processedFiles,
        totalFiles,
      };
    } catch (error) {
      console.error(`❌ BATCH Job ${job.id} failed: ${error.message}`);
      console.log(error);
      sendMessageToClients({
        jobId: job.id,
        status: "failed",
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    limiter: { max: 10, duration: 5000 },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
      timeout: 100000,
    },
  }
);

// Handle worker events
htmlBatchWorker.on("failed", (job, err) => {
  console.error(
    `❌ BATCH Worker job ${job.id} failed with error: ${err.message}`
  );
  console.log(err);
});

htmlBatchWorker.on("completed", (job) => {
  console.log(`✓ BATCH Worker job ${job.id} completed`);
});

htmlBatchWorker.on("error", (err) => {
  console.error("❌ BATCH Worker error:", err);
  console.log(err);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔌 Closing HTML BATCH Worker...");
  await htmlBatchWorker.close();
});

process.on("SIGTERM", async () => {
  console.log("🔌 Closing HTML BATCH Worker...");
  await htmlBatchWorker.close();
});

console.log("✅ HTML BATCH Worker initialized for batch processing");

module.exports = { htmlBatchWorker };
