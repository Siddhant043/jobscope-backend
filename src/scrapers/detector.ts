import type { JobScraper } from "./interface.js";
import { PlaywrightScraper } from "./playwrightScraper.js";
import { CheerioScraper } from "./cheerioScraper.js";
import { ApiScraper } from "./apiScraper.js";
import { RemoteOkScraper } from "./remoteokScraper.js";

const LINKEDIN = /linkedin\.com/i;
const WELLFOUND = /wellfound\.com/i;
const REMOTEOK = /remoteok\.com/i;
const YCOMBINATOR = /ycombinator\.com/i;

export function detectPlatform(url: string): string {
  if (LINKEDIN.test(url)) return "linkedin";
  if (WELLFOUND.test(url)) return "wellfound";
  if (REMOTEOK.test(url)) return "remoteok";
  if (YCOMBINATOR.test(url)) return "ycombinator";
  return "default";
}

const playwrightScraper = new PlaywrightScraper();
const cheerioScraper = new CheerioScraper();
const apiScraper = new ApiScraper();
const remoteOkScraper = new RemoteOkScraper();

export function detectScraper(url: string): JobScraper {
  const platform = detectPlatform(url);
  if (platform === "linkedin") {
    return playwrightScraper;
  }
  if (platform === "ycombinator") {
    return apiScraper;
  }
  if (platform === "remoteok") {
    return remoteOkScraper;
  }
  return cheerioScraper;
}
