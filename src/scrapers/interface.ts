export interface RawJob {
  title: string;
  company: string;
  location?: string;
  salary?: string;
  description: string;
  applyUrl: string;
}

export interface JobScraper {
  scrape(url: string): Promise<RawJob[]>;
}
