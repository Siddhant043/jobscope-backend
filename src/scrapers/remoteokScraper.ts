import got from "got";
import type { RawJob, JobScraper } from "./interface.js";

const REMOTEOK_API_URL = "https://remoteok.com/api";

interface RemoteOkJobItem {
  id?: number;
  company?: string;
  position?: string;
  description?: string;
  url?: string;
  apply_url?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  [key: string]: unknown;
}

/**
 * Normalizes a job-listing URL to the RemoteOK JSON API URL so we always
 * fetch structured data instead of scraping HTML.
 */
function toApiUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, "");
  if (/^https?:\/\/remoteok\.com\/?$/i.test(normalized)) {
    return REMOTEOK_API_URL;
  }
  if (/^https?:\/\/remoteok\.com\/api/i.test(normalized)) {
    return normalized;
  }
  return REMOTEOK_API_URL;
}

function formatSalary(min?: number, max?: number): string | undefined {
  if (min != null && max != null && (min > 0 || max > 0)) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  }
  if (min != null && min > 0) return `$${min.toLocaleString()}+`;
  if (max != null && max > 0) return `Up to $${max.toLocaleString()}`;
  return undefined;
}

export class RemoteOkScraper implements JobScraper {
  async scrape(url: string): Promise<RawJob[]> {
    const apiUrl = toApiUrl(url);
    const response = await got<RemoteOkJobItem[]>(apiUrl, {
      responseType: "json",
      timeout: { request: 20000 },
    });
    const body = response.body;
    const arr = Array.isArray(body) ? body : [];
    return arr
      .filter(
        (item): item is RemoteOkJobItem =>
          item != null &&
          typeof item === "object" &&
          (item.position != null || item.company != null) &&
          item.id != null
      )
      .map((item) => ({
        title: String(item.position ?? "Unknown"),
        company: String(item.company ?? "Unknown"),
        location: item.location ? String(item.location) : undefined,
        salary: formatSalary(item.salary_min, item.salary_max),
        description: item.description ? String(item.description) : String(item.position ?? ""),
        applyUrl: item.url ? String(item.url) : item.apply_url ? String(item.apply_url) : apiUrl,
      }));
  }
}
