const axios = require("axios");

const apiKeyMiddleware = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) return res.status(401).json({ error: "API key required" });

    // Call Auth Service API for validation
    const response = await axios.get(
      "http://localhost:5000/api/api-key/validate",
      {
        headers: { "x-api-key": apiKey },
      }
    );

    if (response.data.valid) {
      req.apiUser = response.data.data;
      return next();
    }

    return res.status(403).json({ error: "Invalid API key" });
  } catch (error) {
    // console.error("API Key Middleware Error:", error);
    return res.status(500).json({ error: "Auth Service Error" });
  }
};

module.exports = apiKeyMiddleware;
