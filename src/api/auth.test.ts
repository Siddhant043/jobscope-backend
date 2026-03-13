import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../server.js";

describe("POST /auth/login", () => {
  const app = createApp();

  it("returns 400 for invalid body (missing email)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ password: "secret123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid body (invalid email)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "not-an-email", password: "secret" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for valid shape but wrong credentials when no user exists", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nonexistent@example.com", password: "password123" });
    expect([400, 401]).toContain(res.status);
  });
});
