import got from "got";
import * as cheerio from "cheerio";
import type { RawJob, JobScraper } from "./interface.js";

const USER_AGENT =
  "Mozilla/5.0 (compatible; JobScope/1.0; +https://jobscope.example.com)";

export class CheerioScraper implements JobScraper {
  async scrape(url: string): Promise<RawJob[]> {
    const response = await got(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: { request: 15000 },
    });
    const $ = cheerio.load(response.body);
    const jobs: RawJob[] = [];
    $("tr.job, .job-listing, [data-job], .job, .position").each((_, el) => {
      const $el = $(el);
      const title =
        $el.find(".title, .job-title, h2, h3, a.job").first().text().trim() ||
        $el.find("td").eq(1).text().trim();
      const company =
        $el.find(".company, .company-name").first().text().trim() ||
        $el.find("td").eq(2).text().trim();
      const link = $el.find("a[href*='job'], a[href*='apply']").attr("href");
      const applyUrl = link
        ? (link.startsWith("http") ? link : new URL(link, url).href)
        : url;
      const description =
        $el.find(".description, .summary, p").first().text().trim() || title;
      const location = $el.find(".location").first().text().trim() || undefined;
      const salary = $el.find(".salary, .pay").first().text().trim() || undefined;
      if (title && company) {
        jobs.push({
          title,
          company,
          location: location || undefined,
          salary: salary || undefined,
          description,
          applyUrl,
        });
      }
    });
    return jobs;
  }
}
