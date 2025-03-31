const axios = require("axios");
const { redisConnection } = require("../config/redisConfig"); // Import Redis

const apiKeyMiddleware = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) return res.status(401).json({ error: "API key required" });

    // Check Redis for cached API key details
    let cachedKey = await redisConnection.get(`api_key:${apiKey}`);

    if (cachedKey) {
      console.log("✅ API Key found in Redis");
      req.apiUser = JSON.parse(cachedKey);
      console.log(req.apiUser);

      // 🛑 Check if usage limit is exceeded
      if (req.apiUser.usageCount >= req.apiUser.planLimit) {
        console.log(req.apiUser.usageCount, req.apiUser.planLimit);
        return res.status(429).json({ error: "API limit exceeded" });
      }

      return next();
    }

    console.log("🔄 API Key not found in Redis. Fetching from Auth Service...");

    // If not in Redis, call Auth Service API
    const response = await axios.get(
      "http://localhost:5000/api/api-key/validate",
      { headers: { "x-api-key": apiKey } }
    );

    if (response.data.valid) {
      req.apiUser = response.data.data;

      // 🛑 Check if usage limit is exceeded
      if (req.apiUser.usageCount >= req.apiUser.planLimit) {
        return res.status(429).json({ error: "API limit exceeded" });
      }

      // Cache API key details in Redis for 10 minutes (600 seconds)
      await redisConnection.set(
        `api_key:${apiKey}`,
        JSON.stringify(response.data.data),
        "EX",
        600
      );

      return next();
    }

    return res.status(403).json({ error: "Invalid API key" });
  } catch (error) {
    console.error("API Key Middleware Error:", error.message);
    return res.status(500).json({ error: "Auth Service Error" });
  }
};

module.exports = apiKeyMiddleware;
