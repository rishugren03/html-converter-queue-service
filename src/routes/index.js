const express = require("express");
const { addHtmlToQueue } = require("../controllers/htmlController");
const { addUrlToQueue } = require("../controllers/urlController");

const router = express.Router();

router.post("/html", addHtmlToQueue);
router.post("/url", addUrlToQueue);

module.exports = router;
