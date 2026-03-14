import { vi } from "vitest";

vi.mock("../lib/config.js", () => ({
  config: {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    JWT_SECRET: "a".repeat(32),
    ANTHROPIC_API_KEY: "sk-ant-test",
    OPENAI_API_KEY: "sk-test",
    AWS_REGION: "us-east-1",
    AWS_ACCESS_KEY_ID: "test",
    AWS_SECRET_ACCESS_KEY: "test",
    S3_BUCKET: "test-bucket",
    CLIENT_URL: "http://localhost:3000",
    PORT: 3000,
  },
}));

vi.mock("../db/index.js", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      resumes: { findFirst: vi.fn(), findMany: vi.fn() },
      sources: { findMany: vi.fn() },
      jobs: { findFirst: vi.fn() },
    },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue("PONG"),
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockImplementation((_ch: string, cb?: (err?: Error) => void) => cb?.()),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue("OK"),
  })),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));
