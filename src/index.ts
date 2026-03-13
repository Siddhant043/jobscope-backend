import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./server.js";
import { initDb } from "./db/index.js";
import { pool } from "./db/index.js";
import { closeRedis, getRedis } from "./lib/redis.js";
import { attachWss } from "./lib/ws.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";

const app = createApp();
const server = createServer(app);
attachWss(server);

async function main() {
  logger.info("Starting JobScope API server...");
  await initDb();
  const redis = getRedis();
  await redis.ping();
  logger.info("Redis connected");
  logger.info("WebSocket server attached on path /ws");
  server.listen(config.PORT, () => {
    logger.info("HTTP server listening", { port: config.PORT });
    logger.info("Bull Board queue dashboard", {
      url: `http://localhost:${config.PORT}/admin/queues`,
    });
  });
}

function shutdown(signal: string) {
  logger.info("Shutdown signal received", { signal });
  server.close(() => {
    logger.info("HTTP server closed");
  });
  pool.end().then(() => {
    logger.info("DB pool drained");
  });
  closeRedis().then(() => {
    logger.info("Redis closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  logger.error("Failed to start server", { error: err });
  process.exit(1);
});
