import { describe, it, expect } from "vitest";
import { detectPlatform, detectScraper } from "./detector.js";
import type { JobScraper } from "./interface.js";

describe("detectPlatform", () => {
  it("detects linkedin", () => {
    expect(detectPlatform("https://www.linkedin.com/jobs")).toBe("linkedin");
  });

  it("detects wellfound", () => {
    expect(detectPlatform("https://wellfound.com/jobs")).toBe("wellfound");
  });

  it("detects remoteok", () => {
    expect(detectPlatform("https://remoteok.com/remote-jobs")).toBe("remoteok");
  });

  it("detects ycombinator", () => {
    expect(detectPlatform("https://www.ycombinator.com/jobs")).toBe("ycombinator");
  });

  it("returns default for unknown", () => {
    expect(detectPlatform("https://example.com/jobs")).toBe("default");
  });
});

describe("detectScraper", () => {
  it("returns PlaywrightScraper for linkedin", () => {
    const scraper = detectScraper("https://linkedin.com/jobs");
    expect(scraper).toBeDefined();
    expect(typeof (scraper as JobScraper).scrape).toBe("function");
  });

  it("returns PlaywrightScraper for wellfound", () => {
    const scraper = detectScraper("https://wellfound.com/jobs");
    expect(scraper).toBeDefined();
    expect(typeof (scraper as JobScraper).scrape).toBe("function");
  });

  it("returns scraper for remoteok", () => {
    const scraper = detectScraper("https://remoteok.com/jobs");
    expect(scraper).toBeDefined();
  });

  it("returns scraper for ycombinator", () => {
    const scraper = detectScraper("https://ycombinator.com/jobs");
    expect(scraper).toBeDefined();
  });

  it("returns scraper for default URL", () => {
    const scraper = detectScraper("https://example.com/jobs");
    expect(scraper).toBeDefined();
  });
});
