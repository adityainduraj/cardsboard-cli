import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("🔌 Client connected");

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log("📨 Received:", data.type);
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    });

    ws.on("close", () => {
      console.log("🔌 Client disconnected");
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));
  });

  return wss;
}
