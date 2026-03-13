import {
  pgTable,
  uuid,
  text,
  jsonb,
  real,
  timestamp,
  vector,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  s3Key: text("s3_key").notNull(),
  status: text("status").default("pending"), // pending | ready | failed
  skills: jsonb("skills").$type<string[]>(),
  techStack: jsonb("tech_stack").$type<string[]>(),
  seniority: text("seniority"),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull(),
  lastScrapedAt: timestamp("last_scraped_at"),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => sources.id),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  salary: text("salary"),
  description: text("description").notNull(),
  applyUrl: text("apply_url").notNull(),
  skills: jsonb("skills").$type<string[]>(),
  seniority: text("seniority"),
  techStack: jsonb("tech_stack").$type<string[]>(),
  embedding: vector("embedding", { dimensions: 1536 }),
  urlHash: text("url_hash").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    jobId: uuid("job_id")
      .references(() => jobs.id)
      .notNull(),
    score: real("score").notNull(),
    skillsDelta: jsonb("skills_delta").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.userId, t.jobId)]
);
