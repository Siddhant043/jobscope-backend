import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { config } from "../lib/config.js";
import { getRedis } from "../lib/redis.js";
import { db, pool } from "../db/index.js";
import { resumes } from "../db/schema.js";
import { getBuffer } from "../storage/s3.js";
import { extractResumeText } from "../lib/extractText.js";
import { extractResumeStructured } from "../agents/resumeAgent.js";
import { computeEmbedding } from "../lib/embeddings.js";
import type { ParseJobData } from "../queue/queues.js";
import { logger } from "../lib/logger.js";

const worker = new Worker<ParseJobData>(
  "parse",
  async (job) => {
    const { resumeId, s3Key } = job.data;
    logger.info("Parse job started", { jobId: job.id, queue: "parse", resumeId });

    const buffer = await getBuffer(s3Key);
    const rawText = await extractResumeText(buffer, s3Key);
    const extracted = await extractResumeStructured(rawText);
    const embedding = await computeEmbedding(rawText);

    await db
      .update(resumes)
      .set({
        skills: extracted.skills,
        techStack: extracted.techStack,
        seniority: extracted.seniority,
        embedding,
        status: "ready",
      })
      .where(eq(resumes.id, resumeId));

    const [row] = await db
      .select({ userId: resumes.userId })
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);
    if (row) {
      const redis = getRedis();
      await redis.publish(
        "resume:ready",
        JSON.stringify({ userId: row.userId, resumeId })
      );
    }

    logger.info("Parse job finished", { jobId: job.id, queue: "parse", resumeId });
  },
  {
    connection: {
      host: new URL(config.REDIS_URL).hostname,
      port: parseInt(new URL(config.REDIS_URL).port || "6379", 10),
    },
    concurrency: 3,
  }
);

worker.on("failed", (job, err) => {
  logger.error("Parse job failed", {
    jobId: job?.id,
    queue: "parse",
    error: err?.message,
    resumeId: job?.data?.resumeId,
  });
  if (job?.data?.resumeId) {
    db.update(resumes)
      .set({ status: "failed" })
      .where(eq(resumes.id, job.data.resumeId))
      .catch((e) => logger.error("Failed to set resume status", { error: e }));
  }
});

worker.on("error", (err) => {
  logger.error("Parse worker error", { error: err.message });
});

async function main() {
  const redis = getRedis();
  await redis.ping();
  logger.info("Parse worker: Redis connected");
  await pool.query("SELECT 1");
  logger.info("Parse worker: Database connected");
  logger.info("Parse worker running", { queue: "parse", concurrency: 3 });
}

main().catch((err) => {
  logger.error("Parse worker failed to start", { error: err.message });
  process.exit(1);
});
