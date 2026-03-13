import { chromium } from "playwright";
import type { RawJob, JobScraper } from "./interface.js";

export class PlaywrightScraper implements JobScraper {
  async scrape(url: string): Promise<RawJob[]> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const jobs = await page.evaluate(() => {
        const results: RawJob[] = [];
        const cards = document.querySelectorAll(
          "[data-job-id], [data-job-card], .job-card, .jobs-list__item, [class*='job']"
        );
        cards.forEach((el) => {
          const titleEl =
            el.querySelector("[data-job-title], .job-title, h2, h3") ||
            el.querySelector("a[href*='/jobs/']");
          const companyEl =
            el.querySelector("[data-company], .company-name, .company") ||
            el.querySelector("a[href*='/company/']");
          const linkEl = el.querySelector("a[href*='/jobs/'], a[href*='job']");
          const title = titleEl?.textContent?.trim() ?? "";
          const company = companyEl?.textContent?.trim() ?? "";
          const applyUrl = (linkEl as HTMLAnchorElement)?.href ?? "";
          const descEl = el.querySelector(".description, .job-desc, p");
          const description = descEl?.textContent?.trim() ?? "";
          if (title && company && applyUrl) {
            results.push({
              title,
              company,
              description: description || title,
              applyUrl,
            });
          }
        });
        return results;
      });
      return jobs.filter((j) => j.title && j.company && j.applyUrl);
    } finally {
      await browser.close();
    }
  }
}
