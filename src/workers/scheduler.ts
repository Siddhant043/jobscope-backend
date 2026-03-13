import "dotenv/config";
import { scrapeQueue } from "../queue/queues.js";
import { getRedis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

const REPEAT_PATTERN = "0 */6 * * *"; // every 6 hours
const JOB_ID = "rescrape-all-sources";

export async function registerRepeatables(): Promise<void> {
  const redis = getRedis();
  await redis.ping();
  logger.info("Scheduler: Redis connected");
  await scrapeQueue.add(
    "rescrape-all",
    {},
    {
      repeat: { pattern: REPEAT_PATTERN },
      jobId: JOB_ID,
    }
  );
  logger.info("Scheduler: repeatable job registered", { pattern: REPEAT_PATTERN });
}

registerRepeatables().catch((err) => {
  logger.error("Scheduler: failed to register repeatables", { error: err });
  process.exit(1);
});
