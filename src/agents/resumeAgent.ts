import { z } from "zod";
import { getChatModel } from "../lib/llm/getChatModel.js";

const WorkHistoryEntrySchema = z.object({
  company: z.string(),
  role: z.string(),
  startYear: z.number(),
  endYear: z.number().nullable(),
  isIntern: z.boolean(),
  isFullTime: z.boolean(),
});

const OUTPUT_SCHEMA = z.object({
  skills: z.array(z.string()),
  techStack: z.array(z.string()),
  workHistory: z.array(WorkHistoryEntrySchema),
  seniority: z.enum(["junior", "mid", "senior", "lead", "unknown"]),
  roles: z.array(z.string()),
});

export type WorkHistoryEntry = z.infer<typeof WorkHistoryEntrySchema>;
export type ResumeExtraction = z.infer<typeof OUTPUT_SCHEMA>;

const MAX_CHARS = 6000;

/**
 * Computes total years of experience from work history.
 * Counts only full-time professional roles. Internships, co-ops, and part-time work are excluded.
 * Merges overlapping date ranges to avoid double-counting.
 */
export function computeExperienceYears(
  workHistory: WorkHistoryEntry[],
): number {
  const now = new Date().getFullYear();

  // Exclude entries where isIntern is true, regardless of isFullTime
  const nonInternFullTime = workHistory.filter(
    (e) => !e.isIntern && e.isFullTime,
  );
  if (nonInternFullTime.length === 0) return 0;

  const intervals: [number, number][] = nonInternFullTime.map((e) => {
    const end = e.endYear ?? now;
    return [e.startYear, end];
  });

  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1];
    if (!last || start > last[1] + 1) {
      merged.push([start, end]);
    } else {
      last[1] = Math.max(last[1], end);
    }
  }

  let totalYears = 0;
  for (const [start, end] of merged) {
    totalYears += end - start + 1;
  }
  return Math.round(totalYears * 10) / 10;
}

export async function extractResumeStructured(
  rawText: string,
): Promise<ResumeExtraction> {
  const truncated =
    rawText.length > MAX_CHARS ? rawText.slice(0, MAX_CHARS) : rawText;
  const baseModel = await getChatModel();
  const model = baseModel.withStructuredOutput(OUTPUT_SCHEMA);

  const result = await model.invoke([
    {
      role: "user",
      content: `Extract the following from this resume text.

1. skills: array of skill names (strings).
2. techStack: array of technologies/tools (strings).
3. workHistory: array of each job/position with:
   - company: company name
   - role: job title
   - startYear: year started (number, e.g. 2020)
   - endYear: year ended (number, or null if current job) if null, set to current year
   - isIntern: true for internship, co-op, or "intern" roles only; false for all other professional roles (experience will exclude these)
   - isFullTime: true only for full-time employment; false for part-time, contract, or freelance
   List every position from the resume. Experience is computed from full-time non-intern roles only; internships and part-time work are not counted.
4. seniority: one of junior, mid, senior, lead, unknown.
5. roles: job titles or roles the candidate is suited for (strings).

Resume text:\n${truncated}`,
    },
  ]);
  return result as ResumeExtraction;
}
