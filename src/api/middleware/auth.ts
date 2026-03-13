import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../lib/config.js";
import { AppError } from "../../lib/errors.js";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (typeof req.query.token === "string") {
    token = req.query.token;
  }
  if (!token) {
    next(new AppError(401, "Missing or invalid authorization"));
    return;
  }
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { sub: string };
    req.userId = decoded.sub;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}
