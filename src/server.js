require("dotenv").config();
const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const { setupWebSocket } = require("./config/web-scket");

// worker
require("./workers/htmlWorker");
require("./workers/urlWorker");

// routes
const jobRoutes = require("./routes/index");

const app = express();
app.use(express.json());
// app.use(express.raw({ type: "application/octet-stream" }));

// web-socket
const server = http.createServer(app); // Create HTTP server
setupWebSocket(server); // Pass the server to WebSocket setup

app.use("/job", jobRoutes);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Queue Service running on port ${PORT}`);
  console.log(`📡 WebSocket server running on ws://localhost:${PORT}`);
});
