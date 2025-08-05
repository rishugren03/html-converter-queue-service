const { Server } = require("ws");

let clients = new Map(); // Store connected clients with metadata
// Store completed job messages for clients that connect later
let pendingJobMessages = new Map(); // jobId -> message

function setupWebSocket(server) {
  const wss = new Server({
    server,
    clientTracking: true,
    perMessageDeflate: {
      deflate: false,
      concurrencyLimit: 10,
      threshold: 1024,
    },
  });

  wss.on("connection", (ws, req) => {
    const clientId = Math.random().toString(36).substring(2, 15);
    const clientInfo = {
      id: clientId,
      socket: ws,
      connectedAt: new Date(),
      lastSeen: new Date(),
      ip: req.socket.remoteAddress,
    };

    clients.set(clientId, clientInfo);
    console.log(
      `📡 Client ${clientId} connected to WebSocket from ${clientInfo.ip}`
    );

    // Send connection confirmation
    ws.send(
      JSON.stringify({
        type: "connection",
        clientId: clientId,
        status: "connected",
      })
    );

    // Check for pending job messages and send them to this client
    if (pendingJobMessages.size > 0) {
      console.log(
        `📬 Sending ${pendingJobMessages.size} pending job messages to client ${clientId}`
      );
      for (const [jobId, message] of pendingJobMessages.entries()) {
        try {
          ws.send(JSON.stringify(message));
          console.log(
            `📤 Sent pending job ${jobId} message to client ${clientId}`
          );
        } catch (error) {
          console.error(
            `❌ Error sending pending message to ${clientId}:`,
            error
          );
        }
      }
      // Clear pending messages after sending
      pendingJobMessages.clear();
    }

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`📩 Received message from ${clientId}:`, data);

        // Update last seen
        if (clients.has(clientId)) {
          clients.get(clientId).lastSeen = new Date();
        }

        // Handle ping/pong for keepalive
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch (error) {
        console.error(`❌ Error parsing message from ${clientId}:`, error);
      }
    });

    ws.on("close", (code, reason) => {
      console.log(
        `📋 Client ${clientId} disconnected (${code}: ${reason}) - ready for reconnection`
      );
      clients.delete(clientId);
    });

    ws.on("error", (error) => {
      console.error(`❌ WebSocket error for client ${clientId}:`, error);
      // Only remove from tracking, don't force close
      clients.delete(clientId);
    });

    // Ping client periodically to detect dead connections
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
  });

  // Health check every 30 seconds (but don't terminate connections)
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        // Just log but don't terminate - keep persistent connections
        console.log(
          "⚠️ Connection appears unresponsive but maintaining persistent connection"
        );
      }

      ws.isAlive = false;
      ws.ping();
    });

    // Clean up only from our clients map for memory management, but don't close connections
    const now = new Date();
    for (const [clientId, clientInfo] of clients.entries()) {
      const timeSinceLastSeen = now - clientInfo.lastSeen;
      const timeSinceConnected = now - clientInfo.connectedAt;

      // Debug: Log client timing info
      console.log(
        `🔍 Client ${clientId}: connected ${timeSinceConnected}ms ago, last seen ${timeSinceLastSeen}ms ago`
      );

      // Add grace period for newly connected clients (don't remove within first 2 minutes)
      if (timeSinceConnected < 120000) {
        console.log(`⏳ Client ${clientId} in grace period - not removing`);
        continue;
      }

      if (timeSinceLastSeen > 300000) {
        // 5 minutes (more lenient)
        console.log(
          `🧹 Removing stale client ${clientId} from memory (connection remains open)`
        );
        clients.delete(clientId);
      }
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  console.log("📡 WebSocket server is ready!");
  return wss;
}

// ✅ Function to send messages to all connected clients with error handling
function sendMessageToClients(data) {
  const message = JSON.stringify(data);
  let sentCount = 0;
  let errorCount = 0;

  clients.forEach((clientInfo, clientId) => {
    const ws = clientInfo.socket;

    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(message);
        sentCount++;
      } catch (error) {
        console.error(`❌ Error sending message to client ${clientId}:`, error);
        errorCount++;
        // Remove dead client
        clients.delete(clientId);
      }
    } else {
      // Clean up closed connections
      clients.delete(clientId);
    }
  });

  // If no clients received the message and it's a job-related message, store it for later
  if (
    sentCount === 0 &&
    data.jobId &&
    (data.status === "completed" || data.status === "failed")
  ) {
    console.log(
      `💾 No clients connected - storing job ${data.jobId} message for later delivery`
    );
    pendingJobMessages.set(data.jobId, data);

    // Clean up old pending messages (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 600000;
    for (const [jobId, jobMessage] of pendingJobMessages.entries()) {
      if (jobMessage.timestamp && jobMessage.timestamp < tenMinutesAgo) {
        console.log(`🧹 Removing old pending message for job ${jobId}`);
        pendingJobMessages.delete(jobId);
      }
    }

    // Add timestamp to track message age
    data.timestamp = Date.now();
  }

  if (data.jobId) {
    console.log(
      `📤 Sent job ${data.jobId} update to ${sentCount} clients (${errorCount} errors)`
    );
  }
}

// Function to send messages to specific client by ID (future enhancement)
function sendMessageToClient(clientId, data) {
  const clientInfo = clients.get(clientId);
  if (!clientInfo) {
    console.warn(`⚠️ Client ${clientId} not found`);
    return false;
  }

  const ws = clientInfo.socket;
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`❌ Error sending message to client ${clientId}:`, error);
      clients.delete(clientId);
      return false;
    }
  } else {
    clients.delete(clientId);
    return false;
  }
}

// Get connected clients count
function getConnectedClientsCount() {
  return clients.size;
}

module.exports = {
  setupWebSocket,
  sendMessageToClients,
  sendMessageToClient,
  getConnectedClientsCount,
};
