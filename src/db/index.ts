import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: false });
export const db = drizzle(pool, { schema });
export { pool };

// Run once to enable pgvector extension and HNSW indexes
export async function initDb(): Promise<void> {
  await pool.query("SELECT 1");
  logger.info("Database connected (PostgreSQL)");
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query(`
    CREATE INDEX IF NOT EXISTS jobs_embedding_hnsw_idx
    ON jobs USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS resumes_embedding_hnsw_idx
    ON resumes USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `);
  logger.info("Database ready (pgvector + HNSW indexes)");
}
