// Build-time access to the generated data files (server components only).

import fs from "node:fs";
import path from "node:path";
import type { RatingKey } from "./model";
import type { LogEntry, RatingSystem, SiteSummary } from "./site-data";

const GENERATED = path.join(process.cwd(), "data", "generated");

let summaryCache: SiteSummary | null = null;

export function loadSummary(): SiteSummary {
  summaryCache ??= JSON.parse(fs.readFileSync(path.join(GENERATED, "summary.json"), "utf8")) as SiteSummary;
  return summaryCache;
}

/** One driver's log for one rating, read at build time; [] if they have none. */
export function loadDriverLog(id: string, key: RatingKey, system: RatingSystem = "default"): LogEntry[] {
  const file = path.join(process.cwd(), "public", "data", "drivers", id, system, `${key}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as LogEntry[]) : [];
}
