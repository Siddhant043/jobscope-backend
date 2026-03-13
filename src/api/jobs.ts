import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import { resumes, jobs } from "../db/schema.js";
import { cosineSimilarity, keywordOverlap, hybridScore } from "../lib/scoring.js";
import { authenticate } from "./middleware/auth.js";
import type { AuthRequest } from "./middleware/auth.js";
import { NotFoundError } from "../lib/errors.js";

const DEFAULT_LIMIT = 20;
const ANN_LIMIT = 500;

export const jobsRouter = Router();

jobsRouter.use(authenticate);

jobsRouter.get("/feed", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));

    const latestResume = await db.query.resumes.findFirst({
      where: eq(resumes.userId, userId),
      orderBy: [desc(resumes.createdAt)],
      columns: { id: true, embedding: true, skills: true, status: true },
    });

    if (
      !latestResume ||
      latestResume.status !== "ready" ||
      !latestResume.embedding ||
      !Array.isArray(latestResume.embedding) ||
      latestResume.embedding.length === 0
    ) {
      res.json([]);
      return;
    }

    const embedding = latestResume.embedding as number[];
    const vectorStr = `[${embedding.join(",")}]`;

    const { rows } = await pool.query<{
      id: string;
      title: string;
      company: string;
      location: string | null;
      salary: string | null;
      apply_url: string;
      skills: string[] | null;
      seniority: string | null;
      embedding: number[] | null;
    }>(
      `SELECT id, title, company, location, salary, apply_url, skills, seniority, embedding
       FROM jobs
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vectorStr, ANN_LIMIT]
    );

    const resumeSkills = latestResume.skills ?? [];
    const scored = rows.map((row) => {
      const cos =
        row.embedding && row.embedding.length
          ? cosineSimilarity(embedding, row.embedding)
          : 0;
      const kw = keywordOverlap(resumeSkills, row.skills ?? []);
      const score = hybridScore(cos, kw);
      return {
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        salary: row.salary,
        applyUrl: row.apply_url,
        skills: row.skills ?? [],
        seniority: row.seniority,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const start = (page - 1) * limit;
    const slice = scored.slice(start, start + limit);
    res.json(slice);
  } catch (e) {
    next(e);
  }
});

jobsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
    if (!id) throw new NotFoundError("Job not found");
    const row = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
    });
    if (!row) throw new NotFoundError("Job not found");
    res.json({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      salary: row.salary,
      description: row.description,
      applyUrl: row.applyUrl,
      skills: row.skills ?? [],
      seniority: row.seniority,
      techStack: row.techStack ?? [],
      createdAt: row.createdAt,
    });
  } catch (e) {
    next(e);
  }
});
