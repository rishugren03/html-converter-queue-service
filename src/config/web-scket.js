const { Server } = require("ws");

let clients = new Set(); // Store connected clients

function setupWebSocket(server) {
  const wss = new Server({ server });

  wss.on("connection", (ws) => {
    console.log("📡 Client connected to WebSocket");
    clients.add(ws); // Add client to the set

    ws.on("message", (message) => {
      console.log("📩 Received message:", message.toString());
    });

    ws.on("close", () => {
      console.log("❌ Client disconnected");
      clients.delete(ws); // Remove client on disconnect
    });
  });

  console.log("📡 WebSocket server is ready!");
  return wss;
}

// ✅ Function to send messages to all connected clients
function sendMessageToClients(data) {
  const message = JSON.stringify(data);
  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });
}

module.exports = { setupWebSocket, sendMessageToClients };
