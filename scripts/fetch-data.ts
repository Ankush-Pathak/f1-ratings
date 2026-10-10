// Downloads raw results into data/raw/, fetching only what isn't cached yet.
// Finished seasons are fetched once; the current season is refreshed every run.
//
//   npx tsx scripts/fetch-data.ts            # Jolpica + OpenF1
//   npx tsx scripts/fetch-data.ts --jolpica  # Jolpica only
//   npx tsx scripts/fetch-data.ts --openf1   # OpenF1 only
//   npx tsx scripts/fetch-data.ts --full     # ignore the cache and re-fetch everything (weekly)

import fs from "node:fs";
import path from "node:path";
import { fetchSeason } from "../src/lib/sources/jolpica";
import { fetchOpenF1Season } from "../src/lib/sources/openf1";
import { LiveSessionLockout } from "../src/lib/sources/http";

export const FIRST_SEASON = 1982;
const RAW = path.join(process.cwd(), "data", "raw");

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

/** A cached season is final once it was fetched after the season's year ended. */
function isFinal(fetchedAt: string | undefined, season: number): boolean {
  return !!fetchedAt && new Date(fetchedAt).getUTCFullYear() > season;
}

async function fetchJolpica(currentSeason: number, full: boolean) {
  for (let season = FIRST_SEASON; season <= currentSeason; season++) {
    const file = path.join(RAW, "jolpica", `${season}.json`);
    const cached = readJson<{ fetchedAt: string }>(file);
    if (!full && cached && isFinal(cached.fetchedAt, season)) continue;
    console.log(`jolpica: fetching ${season}`);
    writeJson(file, await fetchSeason(season));
  }
}

async function fetchOpenF1(currentSeason: number, full: boolean) {
  for (let season = 2023; season <= currentSeason; season++) {
    const file = path.join(RAW, "openf1", `${season}.json`);
    const cached = readJson<Parameters<typeof fetchOpenF1Season>[1] & { fetchedAt: string }>(file);
    if (!full && cached && isFinal(cached.fetchedAt, season)) continue;
    console.log(`openf1: fetching ${season}`);
    try {
      writeJson(file, await fetchOpenF1Season(season, full ? undefined : (cached ?? undefined)));
    } catch (err) {
      if (err instanceof LiveSessionLockout) {
        console.warn(`openf1: ${err.message}. Keeping cached data; next run will retry.`);
        return;
      }
      throw err;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a === "--jolpica" || a === "--openf1");
  const full = args.includes("--full");
  const currentSeason = new Date().getUTCFullYear();
  if (only !== "--openf1") await fetchJolpica(currentSeason, full);
  if (only !== "--jolpica") await fetchOpenF1(currentSeason, full);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
