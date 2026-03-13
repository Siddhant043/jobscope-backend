import { describe, it, expect } from "vitest";
import { cosineSimilarity, keywordOverlap, hybridScore } from "./scoring.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const a = [1, 2, 3];
    expect(cosineSimilarity(a, [...a])).toBe(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [])).toBe(0);
  });

  it("returns value in [-1, 1] for known vectors", () => {
    const cos = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    expect(cos).toBeGreaterThanOrEqual(-1);
    expect(cos).toBeLessThanOrEqual(1);
    expect(cos).toBeCloseTo(0.9746, 3);
  });
});

describe("keywordOverlap", () => {
  it("returns 0 when job skills is empty", () => {
    expect(keywordOverlap(["a", "b"], [])).toBe(0);
  });

  it("returns 1 when all job skills match resume (case-insensitive)", () => {
    expect(keywordOverlap(["JavaScript", "TypeScript"], ["javascript", "typescript"])).toBe(1);
  });

  it("returns partial match ratio", () => {
    expect(keywordOverlap(["a", "b"], ["a", "b", "c"])).toBeCloseTo(2 / 3, 5);
  });

  it("ignores case", () => {
    expect(keywordOverlap(["Node.js"], ["node.js"])).toBe(1);
  });
});

describe("hybridScore", () => {
  it("returns 0-100 range", () => {
    expect(hybridScore(0, 0)).toBe(0);
    expect(hybridScore(1, 1)).toBe(100);
  });

  it("combines cosine and keyword", () => {
    const s = hybridScore(0.5, 0.5);
    expect(s).toBe(50);
  });
});
