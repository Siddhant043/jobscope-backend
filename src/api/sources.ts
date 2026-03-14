import type { Response, NextFunction } from "express";
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sources } from "../db/schema.js";
import { detectPlatform } from "../scrapers/detector.js";
import { addScrapeJob } from "../queue/queues.js";
import { authenticate } from "./middleware/auth.js";
import type { AuthRequest } from "./middleware/auth.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";

const createSourceSchema = z.object({
  url: z.string().url(),
});

export interface SourceAuthRequest extends AuthRequest {
  sourceRecord?: { id: string; userId: string };
}

function ownSource(
  req: SourceAuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const sourceId =
    typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!sourceId || !req.userId) {
    next(new ForbiddenError());
    return;
  }
  db.query.sources
    .findFirst({ where: eq(sources.id, sourceId) })
    .then((row: { id: string; userId: string } | undefined) => {
      if (!row) {
        next(new NotFoundError("Source not found"));
        return;
      }
      if (row.userId !== req.userId) {
        next(new ForbiddenError());
        return;
      }
      req.sourceRecord = { id: row.id, userId: row.userId };
      next();
    })
    .catch(next);
}

export const sourcesRouter = Router();

sourcesRouter.use(authenticate);

sourcesRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const body = createSourceSchema.parse(req.body);
    const userId = req.userId!;
    const platform = detectPlatform(body.url);
    const [row] = await db
      .insert(sources)
      .values({ userId, url: body.url, platform, status: "processing" })
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
      columns: {
        id: true,
        url: true,
        platform: true,
        status: true,
        lastScrapedAt: true,
      },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

sourcesRouter.get("/:id", ownSource, async (req: SourceAuthRequest, res, next) => {
  try {
    const id = req.sourceRecord!.id;
    const row = await db.query.sources.findFirst({
      where: eq(sources.id, id),
      columns: {
        id: true,
        url: true,
        platform: true,
        status: true,
        lastScrapedAt: true,
      },
    });
    if (!row) {
      next(new NotFoundError("Source not found"));
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

sourcesRouter.delete("/:id", ownSource, async (req: SourceAuthRequest, res, next) => {
  try {
    const id = req.sourceRecord!.id;
    await db.delete(sources).where(eq(sources.id, id));
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
