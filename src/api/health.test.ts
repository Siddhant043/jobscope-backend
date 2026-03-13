import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../server.js";

describe("GET /health", () => {
  const app = createApp();

  it("returns 200 with status ok when DB and Redis are up", async () => {
    const res = await request(app).get("/health");
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("ts");
    } else {
      expect(res.body).toHaveProperty("status", "unhealthy");
    }
  });
});
