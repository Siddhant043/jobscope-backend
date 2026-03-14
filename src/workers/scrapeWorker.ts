import { createHash } from "node:crypto";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { config } from "../lib/config.js";
import { getRedis } from "../lib/redis.js";
import { db, pool } from "../db/index.js";
import { sources, jobs } from "../db/schema.js";
import { detectScraper } from "../scrapers/detector.js";
import { addAiJob, addScrapeJob } from "../queue/queues.js";
import type { ScrapeJobData } from "../queue/queues.js";
import { logger } from "../lib/logger.js";

const DEDUP_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

function urlHash(url: string, company: string, title: string): string {
  return createHash("md5").update(`${url}|${company}|${title}`).digest("hex");
}

const worker = new Worker<ScrapeJobData & { type?: string }>(
  "scrape",
  async (job) => {
    if (job.name === "rescrape-all" || job.data?.type === "rescrape-all") {
      const allSources = await db.select().from(sources);
      for (const s of allSources) {
        await addScrapeJob({ sourceId: s.id, url: s.url });
      }
      logger.info("Scheduler: enqueued scrape jobs for all sources", {
        count: allSources.length,
      });
      return;
    }

    const { sourceId, url } = job.data;
    logger.info("Scrape job started", { jobId: job.id, queue: "scrape", sourceId });

    await db
      .update(sources)
      .set({ status: "processing" })
      .where(eq(sources.id, sourceId));

    const scraper = detectScraper(url);
    const rawJobs = await scraper.scrape(url);

    const redis = getRedis();
    let insertedCount = 0;
    let dedupSkipped = 0;

    for (const rj of rawJobs) {
      const hash = urlHash(url, rj.company, rj.title);
      const dedupKey = `dedup:${hash}`;
      const exists = await redis.get(dedupKey);
      if (exists) {
        dedupSkipped += 1;
        continue;
      }

      const [inserted] = await db
        .insert(jobs)
        .values({
          sourceId,
          title: rj.title,
          company: rj.company,
          location: rj.location ?? null,
          salary: rj.salary ?? null,
          description: rj.description,
          applyUrl: rj.applyUrl,
          urlHash: hash,
        })
        .returning({ id: jobs.id });
      if (inserted) {
        insertedCount += 1;
        await redis.set(dedupKey, "1", "EX", DEDUP_TTL_SEC);
        await addAiJob({ jobId: inserted.id });
      }
    }

    await db
      .update(sources)
      .set({ lastScrapedAt: new Date(), status: "completed" })
      .where(eq(sources.id, sourceId));

    logger.info("Scrape job finished", { jobId: job.id, queue: "scrape", sourceId });
  },
  {
    connection: {
      host: new URL(config.REDIS_URL).hostname,
      port: parseInt(new URL(config.REDIS_URL).port || "6379", 10),
    },
    concurrency: 2,
  }
);

worker.on("failed", (job, err) => {
  logger.error("Scrape job failed", {
    jobId: job?.id,
    queue: "scrape",
    error: err?.message,
    sourceId: job?.data?.sourceId,
  });
  const sourceId = job?.data?.sourceId;
  if (sourceId) {
    db.update(sources)
      .set({ status: "failed" })
      .where(eq(sources.id, sourceId))
      .catch((e) => logger.error("Failed to set source status to failed", { error: e }));
  }
});

worker.on("error", (err) => {
  logger.error("Scrape worker error", { error: err.message });
});

async function main() {
  const redis = getRedis();
  await redis.ping();
  logger.info("Scrape worker: Redis connected");
  await pool.query("SELECT 1");
  logger.info("Scrape worker: Database connected");
  logger.info("Scrape worker running", { queue: "scrape", concurrency: 2 });
}

main().catch((err) => {
  logger.error("Scrape worker failed to start", { error: err.message });
  process.exit(1);
});
