import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { config } from "../lib/config.js";
import { getRedis } from "../lib/redis.js";
import { ValidationError } from "../lib/errors.js";

const SALT_ROUNDS = 12;
const ACCESS_EXPIRY = "90d";
const REFRESH_TTL_DAYS = 30;

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRY,
  });
}

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });
    if (existing) {
      throw new ValidationError("Email already registered");
    }
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
    const [user] = await db
      .insert(users)
      .values({ email: body.email, passwordHash })
      .returning({ id: users.id, email: users.email });
    if (!user) throw new Error("Insert failed");
    const token = signAccessToken(user.id);
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new ValidationError("Invalid email or password");
    }
    const token = signAccessToken(user.id);
    const refreshToken = uuidv4();
    const redis = getRedis();
    await redis.set(
      `refresh:${refreshToken}`,
      user.id,
      "EX",
      REFRESH_TTL_DAYS * 24 * 60 * 60,
    );
    res.json({
      token,
      refreshToken,
      user: { id: user.id, email: user.email },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    const redis = getRedis();
    const userId = await redis.get(`refresh:${body.refreshToken}`);
    if (!userId) {
      throw new ValidationError("Invalid or expired refresh token");
    }
    const newToken = signAccessToken(userId);
    res.json({ token: newToken });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const body = logoutSchema.parse(req.body);
    const redis = getRedis();
    await redis.del(`refresh:${body.refreshToken}`);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
