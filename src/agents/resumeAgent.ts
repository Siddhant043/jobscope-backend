import { z } from "zod";
import { getChatModel } from "../lib/llm/getChatModel.js";

const OUTPUT_SCHEMA = z.object({
  skills: z.array(z.string()),
  techStack: z.array(z.string()),
  seniority: z.enum(["junior", "mid", "senior", "lead", "unknown"]),
  roles: z.array(z.string()),
});

export type ResumeExtraction = z.infer<typeof OUTPUT_SCHEMA>;

const MAX_CHARS = 6000;

export async function extractResumeStructured(
  rawText: string
): Promise<ResumeExtraction> {
  const truncated =
    rawText.length > MAX_CHARS ? rawText.slice(0, MAX_CHARS) : rawText;
  const baseModel = await getChatModel();
  const model = baseModel.withStructuredOutput(OUTPUT_SCHEMA);

  const result = await model.invoke([
    {
      role: "user",
      content: `Extract the following from this resume text. Return skills (array of strings), techStack (array of technologies/tools), seniority (one of: junior, mid, senior, lead, unknown), and roles (job titles or roles the candidate is suited for).\n\nResume text:\n${truncated}`,
    },
  ]);

  return result as ResumeExtraction;
}
