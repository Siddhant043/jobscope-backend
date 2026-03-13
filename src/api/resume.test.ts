import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../server.js";

describe("POST /resume/upload", () => {
  const app = createApp();

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/resume/upload");
    expect(res.status).toBe(401);
  });
});
