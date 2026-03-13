import type { Server as HTTPServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { getRedis } from "./redis.js";
import { logger } from "./logger.js";

const clientsByUserId = new Map<string, WebSocket>();

export function attachWss(server: HTTPServer): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: { url?: string }) => {
    const url = req.url ?? "";
    const params = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?")) : "");
    const token = params.get("token");
    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as { sub: string };
      const userId = decoded.sub;
      if (!userId) {
        ws.close(4001, "Invalid token");
        return;
      }
      clientsByUserId.set(userId, ws);
      ws.on("close", () => {
        clientsByUserId.delete(userId);
      });
      ws.on("error", () => {
        clientsByUserId.delete(userId);
      });
    } catch {
      ws.close(4001, "Invalid token");
    }
  });

  const redisSub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  redisSub.subscribe("resume:ready", "jobs:new", (err?: Error | null) => {
    if (err) {
      logger.error("Redis subscribe error", { error: err });
      return;
    }
  });
  redisSub.on("message", (channel: string, message: string) => {
    try {
      const payload = JSON.parse(message) as { userId?: string; resumeId?: string; count?: number };
      const userId = payload.userId;
      if (userId) {
        if (channel === "resume:ready") {
          pushToUser(userId, { type: "resume:ready", resumeId: payload.resumeId });
        } else if (channel === "jobs:new") {
          pushToUser(userId, { type: "jobs:new", count: payload.count });
        }
      }
    } catch (e) {
      logger.warn("WS Redis message parse error", { channel, message, error: e });
    }
  });
}

export function pushToUser(userId: string, payload: object): void {
  const ws = clientsByUserId.get(userId);
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      logger.warn("pushToUser send error", { userId, error: e });
      clientsByUserId.delete(userId);
    }
  }
}
