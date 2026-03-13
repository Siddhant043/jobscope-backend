import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sources } from "../db/schema.js";
import { detectPlatform, detectScraper } from "../scrapers/detector.js";
import { addScrapeJob } from "../queue/queues.js";
import { authenticate } from "./middleware/auth.js";
import type { AuthRequest } from "./middleware/auth.js";

const createSourceSchema = z.object({
  url: z.string().url(),
});

export const sourcesRouter = Router();

sourcesRouter.use(authenticate);

sourcesRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const body = createSourceSchema.parse(req.body);
    const userId = req.userId!;
    const platform = detectPlatform(body.url);
    const [row] = await db
      .insert(sources)
      .values({ userId, url: body.url, platform })
      .returning({ id: sources.id, platform: sources.platform });
    if (!row) throw new Error("Insert failed");
    await addScrapeJob({ sourceId: row.id, url: body.url });
    res.status(201).json({ sourceId: row.id, platform: row.platform });
  } catch (e) {
    next(e);
  }
});

sourcesRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const list = await db.query.sources.findMany({
      where: eq(sources.userId, userId),
      columns: { id: true, url: true, platform: true, lastScrapedAt: true },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});
