import "dotenv/config";
import { z } from "zod";

const isDev = process.env.NODE_ENV !== "production";

const envWithDefaults = isDev
  ? {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://user:password@localhost:5432/jobscopedb",
      REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
      CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
      JWT_SECRET:
        process.env.JWT_SECRET ||
        "dev-jwt-secret-must-be-at-least-32-characters-long",
      ANTHROPIC_API_KEY:
        process.env.ANTHROPIC_API_KEY || "sk-ant-dev-placeholder",
      AWS_REGION: process.env.AWS_REGION || "us-east-1",
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "dev-placeholder",
      AWS_SECRET_ACCESS_KEY:
        process.env.AWS_SECRET_ACCESS_KEY || "dev-placeholder",
      S3_BUCKET: process.env.S3_BUCKET || "jobscope-dev-bucket",
      OLLAMA_BASE_URL:
        process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || "qwen3.5",
      OLLAMA_EMBEDDING_MODEL:
        process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    }
  : process.env;

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ANTHROPIC_API_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  CLIENT_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().min(1).optional(),
  OLLAMA_EMBEDDING_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof schema>;
export const config = schema.parse(envWithDefaults) as Config;
