/**
 * Cosine similarity between two vectors: dot(a,b) / (|a| * |b|).
 * Returns value in [-1, 1]; for normalized embeddings typically [0, 1].
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Keyword overlap: proportion of job skills that appear in resume skills (case-insensitive).
 * Returns value in [0, 1].
 */
export function keywordOverlap(
  resumeSkills: string[],
  jobSkills: string[]
): number {
  if (jobSkills.length === 0) return 0;
  const resumeSet = new Set(
    resumeSkills.map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  let matched = 0;
  for (const s of jobSkills) {
    const normalized = s.trim().toLowerCase();
    if (normalized && resumeSet.has(normalized)) matched++;
  }
  return matched / jobSkills.length;
}

/**
 * Hybrid match score 0–100: 0.6 * cosine + 0.4 * keywordOverlap, scaled to 100.
 */
export function hybridScore(
  cosine: number,
  keyword: number
): number {
  const raw = cosine * 0.6 + keyword * 0.4;
  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}
