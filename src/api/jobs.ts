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

/** Map frontend platform values to backend sources.platform. */
function mapPlatformFilter(platform: string | undefined): string | undefined {
  if (!platform || platform === "any") return undefined;
  if (platform === "yc-jobs") return "ycombinator";
  if (platform === "remotive") return "remoteok";
  if (platform === "other") return "default";
  return platform; // linkedin, wellfound
}

type ScoredRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  applyUrl: string;
  skills: string[];
  seniority: string | null;
  score: number;
};

function applyFilters(
  scored: ScoredRow[],
  search: string | undefined,
  minScore: number | undefined,
  location: string | undefined,
  remote: string | undefined
): ScoredRow[] {
  let out = scored;
  const q = (search ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.skills.some((s) => s.toLowerCase().includes(q))
    );
  }
  if (minScore != null && Number.isFinite(minScore)) {
    out = out.filter((r) => r.score >= minScore);
  }
  const loc = (location ?? "").trim().toLowerCase();
  if (loc) {
    out = out.filter((r) => (r.location ?? "").toLowerCase().includes(loc));
  }
  if (remote === "true") {
    out = out.filter((r) =>
      (r.location ?? "").toLowerCase().includes("remote")
    );
  } else if (remote === "false") {
    out = out.filter(
      (r) => !(r.location ?? "").toLowerCase().includes("remote")
    );
  }
  return out;
}

export const jobsRouter = Router();

jobsRouter.use(authenticate);

jobsRouter.get("/feed", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT)
    );
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : undefined;
    const minScoreRaw = req.query.minScore;
    const minScore =
      minScoreRaw !== undefined && minScoreRaw !== ""
        ? Math.min(100, Math.max(0, Number(minScoreRaw)))
        : undefined;
    const location =
      typeof req.query.location === "string"
        ? req.query.location.trim()
        : undefined;
    const remote =
      req.query.remote === "true" || req.query.remote === "false"
        ? req.query.remote
        : undefined;
    const platformParam =
      typeof req.query.platform === "string" ? req.query.platform : undefined;
    const platformFilter = mapPlatformFilter(platformParam);

    const latestResume = await db.query.resumes.findFirst({
      where: eq(resumes.userId, userId),
      orderBy: [desc(resumes.createdAt)],
      columns: { id: true, embedding: true, skills: true, status: true },
    });

    const feedEarlyExitReason =
      !latestResume
        ? "no_resume"
        : latestResume.status !== "ready"
          ? "resume_not_ready"
          : !latestResume.embedding ||
              !Array.isArray(latestResume.embedding) ||
              latestResume.embedding.length === 0
            ? "no_embedding"
            : null;
    if (feedEarlyExitReason) {
      res.json({ items: [], total: 0 });
      return;
    }

    const resume = latestResume!;
    const embedding = resume.embedding as number[];
    const vectorStr = `[${embedding.join(",")}]`;

    interface JobRow {
      id: string;
      title: string;
      company: string;
      location: string | null;
      salary: string | null;
      apply_url: string;
      skills: string[] | null;
      seniority: string | null;
      embedding: number[] | null;
    }

    const sql =
      platformFilter === undefined
        ? `SELECT j.id, j.title, j.company, j.location, j.salary, j.apply_url, j.skills, j.seniority, j.embedding
           FROM jobs j
           WHERE j.embedding IS NOT NULL
           ORDER BY j.embedding <=> $1::vector
           LIMIT $2`
        : `SELECT j.id, j.title, j.company, j.location, j.salary, j.apply_url, j.skills, j.seniority, j.embedding
           FROM jobs j
           LEFT JOIN sources s ON j.source_id = s.id
           WHERE j.embedding IS NOT NULL
             AND (s.platform = $2 OR ($2 = 'default' AND (s.platform IS NULL OR s.platform = 'default')))
           ORDER BY j.embedding <=> $1::vector
           LIMIT $3`;

    const queryParams =
      platformFilter === undefined
        ? [vectorStr, ANN_LIMIT]
        : [vectorStr, platformFilter, ANN_LIMIT];

    const { rows } = await pool.query<JobRow>(sql, queryParams);

    const resumeSkills = resume.skills ?? [];
    const scored: ScoredRow[] = rows.map((row) => {
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
    const filtered = applyFilters(scored, search, minScore, location, remote);
    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    res.json({ items, total });
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
