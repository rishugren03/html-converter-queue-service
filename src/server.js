require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

// worker
require("./workers/pdfWorker");

// routes
const pdfRoutes = require("./routes/index");

const app = express();
app.use(bodyParser.json());

app.use("/pdf", pdfRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Queue Service running on port ${PORT}`);
});
