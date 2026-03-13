import { Router, type Request, type Response } from "express";
import { pool } from "../db/index.js";
import { getRedis } from "../lib/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  let dbOk = false;
  let redisOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {
    // ignore
  }
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    redisOk = pong === "PONG";
  } catch {
    // ignore
  }
  if (dbOk && redisOk) {
    res.json({ status: "ok", ts: new Date().toISOString() });
  } else {
    res.status(503).json({
      status: "unhealthy",
      ts: new Date().toISOString(),
      db: dbOk ? "ok" : "down",
      redis: redisOk ? "ok" : "down",
    });
  }
});
