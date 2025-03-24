const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:5001");

ws.on("open", () => console.log("✅ Connected to WebSocket"));
ws.on("message", (msg) => console.log("📩 Message:", msg.toString()));
ws.on("error", (err) => console.error("❌ WebSocket Error:", err.message));
