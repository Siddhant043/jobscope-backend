import { Queue } from "bullmq";
import { config } from "../lib/config.js";

const redisUrl = new URL(config.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: redisUrl.port ? parseInt(redisUrl.port, 10) : 6379,
  ...(redisUrl.password && { password: redisUrl.password }),
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

function createQueue(name: string) {
  return new Queue(name, {
    connection,
    defaultJobOptions,
  });
}

export const parseQueue = createQueue("parse");
export const scrapeQueue = createQueue("scrape");
export const aiQueue = createQueue("ai");

export interface ParseJobData {
  resumeId: string;
  s3Key: string;
}

export interface ScrapeJobData {
  sourceId: string;
  url: string;
}

export interface AiJobData {
  jobId: string;
}

export async function addParseJob(data: ParseJobData): Promise<void> {
  await parseQueue.add("parse", data);
}

export async function addScrapeJob(data: ScrapeJobData): Promise<void> {
  await scrapeQueue.add("scrape", data);
}

export async function addAiJob(data: AiJobData): Promise<void> {
  await aiQueue.add("ai", data);
}
