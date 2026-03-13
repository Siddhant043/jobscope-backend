import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { resumes } from "../db/schema.js";
import { upload as s3Upload, presignedUrl } from "../storage/s3.js";
import { addParseJob } from "../queue/queues.js";
import { authenticate } from "./middleware/auth.js";
import { ownResume } from "./middleware/ownership.js";
import type { AuthRequest } from "./middleware/auth.js";
import type { ResumeAuthRequest } from "./middleware/ownership.js";
import { ValidationError } from "../lib/errors.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

export const resumeRouter = Router();

resumeRouter.use(authenticate);

resumeRouter.post(
  "/upload",
  upload.single("resume"),
  async (req: AuthRequest, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        throw new ValidationError("Missing file field: resume");
      }
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        throw new ValidationError(
          "Invalid file type. Only PDF and DOCX are allowed."
        );
      }
      const userId = req.userId!;
      const ext = file.mimetype === "application/pdf" ? "pdf" : "docx";
      const key = `resumes/${userId}/${uuidv4()}.${ext}`;
      await s3Upload(key, file.buffer, file.mimetype);
      const [row] = await db
        .insert(resumes)
        .values({ userId, s3Key: key, status: "pending" })
        .returning({ id: resumes.id, status: resumes.status });
      if (!row) throw new Error("Insert failed");
      await addParseJob({ resumeId: row.id, s3Key: key });
      res.status(201).json({ resumeId: row.id, status: "pending" });
    } catch (e) {
      next(e);
    }
  }
);

resumeRouter.get("/status", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const latest = await db.query.resumes.findFirst({
      where: eq(resumes.userId, userId),
      orderBy: [desc(resumes.createdAt)],
      columns: {
        id: true,
        status: true,
        skills: true,
        techStack: true,
        seniority: true,
        createdAt: true,
      },
    });
    if (!latest) {
      res.json(null);
      return;
    }
    res.json(latest);
  } catch (e) {
    next(e);
  }
});

resumeRouter.get(
  "/:id/download",
  ownResume,
  async (req: ResumeAuthRequest, res, next) => {
    try {
      const resume = req.resumeRecord!;
      const url = await presignedUrl(resume.s3Key, 3600);
      res.json({ url });
    } catch (e) {
      next(e);
    }
  }
);
