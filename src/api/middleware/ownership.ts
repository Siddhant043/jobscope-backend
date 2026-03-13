import type { Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { resumes } from "../../db/schema.js";
import type { AuthRequest } from "./auth.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

export interface ResumeAuthRequest extends AuthRequest {
  resumeRecord?: { id: string; userId: string; s3Key: string };
}

export function ownResume(
  req: ResumeAuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const resumeId = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!resumeId || !req.userId) {
    next(new ForbiddenError());
    return;
  }
  db.query.resumes.findFirst({ where: eq(resumes.id, resumeId) }).then((row: { id: string; userId: string; s3Key: string } | undefined) => {
    if (!row) {
      next(new NotFoundError("Resume not found"));
      return;
    }
    if (row.userId !== req.userId) {
      next(new ForbiddenError());
      return;
    }
    req.resumeRecord = { id: row.id, userId: row.userId, s3Key: row.s3Key };
    next();
  }).catch(next);
}
