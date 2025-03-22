const express = require("express");
const { addPdfToQueue } = require("../controllers/pdfController");

const router = express.Router();

router.post("/add", addPdfToQueue);

module.exports = router;
