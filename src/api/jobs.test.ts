import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../server.js";

describe("GET /jobs/feed", () => {
  const app = createApp();

  it("returns 401 without auth", async () => {
    const res = await request(app).get("/jobs/feed");
    expect(res.status).toBe(401);
  });
});

describe("GET /jobs/:id", () => {
  const app = createApp();

  it("returns 401 without auth", async () => {
    const res = await request(app).get("/jobs/some-uuid");
    expect(res.status).toBe(401);
  });
});
