import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "./lib/config.js";
import { errorHandler } from "./lib/errors.js";
import { sanitiseBody } from "./api/middleware/sanitise.js";
import { authRouter } from "./api/auth.js";
import { resumeRouter } from "./api/resume.js";
import { sourcesRouter } from "./api/sources.js";
import { jobsRouter } from "./api/jobs.js";
import { healthRouter } from "./api/health.js";
import { parseQueue, scrapeQueue, aiQueue } from "./queue/queues.js";

export function createApp(): Express {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(cors({ origin: config.CLIENT_URL }));
  app.use(express.json());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many requests" },
  });
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: "Too many requests" },
  });

  app.use("/auth", authLimiter, sanitiseBody, authRouter);
  app.use("/resume", generalLimiter, resumeRouter);
  app.use("/sources", generalLimiter, sanitiseBody, sourcesRouter);
  app.use("/jobs", generalLimiter, jobsRouter);
  app.use("/health", healthRouter);

  const bullBoardPath = "/admin/queues";
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(bullBoardPath);
  createBullBoard({
    queues: [
      new BullMQAdapter(parseQueue),
      new BullMQAdapter(scrapeQueue),
      new BullMQAdapter(aiQueue),
    ],
    serverAdapter,
  });
  app.use(bullBoardPath, serverAdapter.getRouter());

  app.use(errorHandler);
  return app;
}
