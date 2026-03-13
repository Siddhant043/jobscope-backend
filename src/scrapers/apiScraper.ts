import got from "got";
import type { RawJob, JobScraper } from "./interface.js";

interface YCJobItem {
  title?: string;
  company_name?: string;
  location?: string;
  salary?: string;
  description?: string;
  url?: string;
  [key: string]: unknown;
}

export class ApiScraper implements JobScraper {
  async scrape(url: string): Promise<RawJob[]> {
    const response = await got<YCJobItem[]>(url, {
      responseType: "json",
      timeout: { request: 15000 },
    });
    const body = response.body;
    const arr = Array.isArray(body) ? body : [body];
    return arr
      .filter((item) => item && (item.title || item.company_name))
      .map((item) => ({
        title: String(item.title ?? "Unknown"),
        company: String(item.company_name ?? item.company ?? "Unknown"),
        location: item.location ? String(item.location) : undefined,
        salary: item.salary ? String(item.salary) : undefined,
        description: item.description ? String(item.description) : String(item.title ?? ""),
        applyUrl: item.url ? String(item.url) : url,
      }));
  }
}
