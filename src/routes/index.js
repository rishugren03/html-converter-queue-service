const express = require("express");
const { addHtmlToQueue } = require("../controllers/htmlController");
const { addUrlToQueue } = require("../controllers/urlController");

// apiKey-validator middleware
const apiKeyMiddleware = require("../middlewares/api-key-validator");

const router = express.Router();

router.post("/html", apiKeyMiddleware, addHtmlToQueue);
router.post("/url", apiKeyMiddleware, addUrlToQueue);

module.exports = router;
