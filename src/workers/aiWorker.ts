import { Worker } from "bullmq";
import { eq, and, isNotNull } from "drizzle-orm";
import { config } from "../lib/config.js";
import { getRedis } from "../lib/redis.js";
import { db, pool } from "../db/index.js";
import { jobs, resumes, matches } from "../db/schema.js";
import { extractJobStructured } from "../agents/jobAgent.js";
import { computeEmbedding } from "../lib/embeddings/index.js";
import {
  cosineSimilarity,
  keywordOverlap,
  hybridScore,
} from "../lib/scoring.js";
import type { AiJobData } from "../queue/queues.js";
import { logger } from "../lib/logger.js";

const worker = new Worker<AiJobData>(
  "ai",
  async (job) => {
    const { jobId } = job.data;

    logger.info("AI job started", {
      jobId: job.id,
      queue: "ai",
      dataJobId: jobId,
    });

    const [jobRow] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    if (!jobRow) {
      logger.warn("AI job: job not found", { dataJobId: jobId });
      return;
    }

    const extracted = await extractJobStructured(jobRow.description);
    const embedding = await computeEmbedding(jobRow.description);

    await db
      .update(jobs)
      .set({
        skills: extracted.skills,
        techStack: extracted.techStack,
        seniority: extracted.seniority,
        embedding,
      })
      .where(eq(jobs.id, jobId));

    const readyResumes = await db
      .select({
        userId: resumes.userId,
        embedding: resumes.embedding,
        skills: resumes.skills,
      })
      .from(resumes)
      .where(and(eq(resumes.status, "ready"), isNotNull(resumes.embedding)));
    // Filter to rows that actually have embedding (non-null)
    const withEmbedding = readyResumes.filter(
      (r) =>
        r.embedding && Array.isArray(r.embedding) && r.embedding.length > 0,
    ) as { userId: string; embedding: number[]; skills: string[] | null }[];

    const jobSkills = extracted.skills ?? [];
    const redis = getRedis();

    for (const r of withEmbedding) {
      const cos = cosineSimilarity(r.embedding, embedding);
      const kw = keywordOverlap(r.skills ?? [], jobSkills);
      const score = hybridScore(cos, kw);
      const skillsDelta = jobSkills.filter(
        (s) =>
          !(r.skills ?? []).some(
            (rs) => rs.trim().toLowerCase() === s.trim().toLowerCase(),
          ),
      );
      await db
        .insert(matches)
        .values({
          userId: r.userId,
          jobId,
          score,
          skillsDelta,
        })
        .onConflictDoUpdate({
          target: [matches.userId, matches.jobId],
          set: { score, skillsDelta },
        });
      await redis.publish(
        "jobs:new",
        JSON.stringify({ userId: r.userId, count: 1 }),
      );
    }

    logger.info("AI job finished", {
      jobId: job.id,
      queue: "ai",
      dataJobId: jobId,
    });
  },
  {
    connection: {
      host: new URL(config.REDIS_URL).hostname,
      port: parseInt(new URL(config.REDIS_URL).port || "6379", 10),
    },
    concurrency: 5,
  },
);

worker.on("failed", (job, err) => {
  logger.error("AI job failed", {
    jobId: job?.id,
    queue: "ai",
    error: err?.message,
    dataJobId: job?.data?.jobId,
  });
});

worker.on("error", (err) => {
  logger.error("AI worker error", { error: err.message });
});

async function main() {
  const redis = getRedis();
  await redis.ping();
  logger.info("AI worker: Redis connected");
  await pool.query("SELECT 1");
  logger.info("AI worker: Database connected");
  logger.info("AI worker running", { queue: "ai", concurrency: 5 });
}

main().catch((err) => {
  logger.error("AI worker failed to start", { error: err.message });
  process.exit(1);
});
