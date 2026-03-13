import type { Request, Response, NextFunction } from "express";

function stripAngleBrackets(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/</g, "").replace(/>/g, "");
  }
  if (Array.isArray(value)) {
    return value.map(stripAngleBrackets);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = stripAngleBrackets(v);
    }
    return out;
  }
  return value;
}

export function sanitiseBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    req.body = stripAngleBrackets(req.body) as Request["body"];
  }
  next();
}
