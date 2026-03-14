import { z } from "zod";
import { getChatModel } from "../lib/llm/getChatModel.js";

const OUTPUT_SCHEMA = z.object({
  skills: z.array(z.string()),
  techStack: z.array(z.string()),
  seniority: z.enum(["junior", "mid", "senior", "lead", "unknown"]),
  roleType: z.string(),
  isRemote: z.boolean(),
});

export type JobExtraction = z.infer<typeof OUTPUT_SCHEMA>;

const MAX_CHARS = 4000;

export async function extractJobStructured(
  description: string
): Promise<JobExtraction> {
  const truncated =
    description.length > MAX_CHARS ? description.slice(0, MAX_CHARS) : description;

  const baseModel = await getChatModel();
  const model = baseModel.withStructuredOutput(OUTPUT_SCHEMA);

  const result = await model.invoke([
    {
      role: "user",
      content: `Extract from this job description: skills (array of strings), techStack (array of technologies), seniority (junior|mid|senior|lead|unknown), roleType (job title or role type string), isRemote (boolean).\n\nJob description:\n${truncated}`,
    },
  ]);

  return result as JobExtraction;
}
