const { Server } = require("ws");

let clients = new Map(); // Store connected clients with metadata

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
      console.log(`❌ Client ${clientId} disconnected (${code}: ${reason})`);
      clients.delete(clientId);
    });

    ws.on("error", (error) => {
      console.error(`❌ WebSocket error for client ${clientId}:`, error);
      clients.delete(clientId);
    });

    // Ping client periodically to detect dead connections
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
  });

  // Clean up dead connections every 30 seconds
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log("🧹 Terminating dead connection");
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });

    // Also clean up from our clients map
    const now = new Date();
    for (const [clientId, clientInfo] of clients.entries()) {
      const timeSinceLastSeen = now - clientInfo.lastSeen;
      if (timeSinceLastSeen > 60000) {
        // 1 minute
        console.log(`🧹 Removing stale client ${clientId}`);
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
