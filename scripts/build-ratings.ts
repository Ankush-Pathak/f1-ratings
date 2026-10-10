// Recomputes every rating from the cached raw data and writes the site's data files.
//   npx tsx scripts/build-ratings.ts

import fs from "node:fs";
import path from "node:path";
import { computeRatings, DEFAULT_CONFIG, type DriverResult, type EngineResult, RECENTRED_CONFIG } from "../src/lib/engine";
import { normalize } from "../src/lib/normalize";
import type { JolpicaSeason } from "../src/lib/sources/jolpica";
import type { OpenF1Season } from "../src/lib/sources/openf1";
import { RATING_KEYS, type RatingKey } from "../src/lib/model";
import type { DriverSummary, RatingSystem, SiteSummary, SystemView } from "../src/lib/site-data";
import type { RaceEvent } from "../src/lib/model";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data", "generated");
// Per-driver logs are served as static files and fetched by the driver page one rating at a time.
const LOGS = path.join(ROOT, "public", "data", "drivers");

const r1 = (n: number) => Math.round(n * 10) / 10;

function readDir<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as T);
}

function systemView(d: DriverResult, events: RaceEvent[]): SystemView {
  const ratings = {} as SystemView["ratings"];
  for (const key of RATING_KEYS) {
    const s = d.ratings[key];
    const pe = s.peakEventIdx >= 0 ? events[s.peakEventIdx] : null;
    ratings[key] = {
      current: r1(s.current),
      peak: r1(s.peak),
      peakEvent: pe ? { season: pe.season, round: pe.round, name: pe.name, date: pe.date } : null,
      matches: s.matches,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      trend: r1(s.trend),
    };
  }
  return { ratings, eventsAtNumberOne: d.eventsAtNumberOne };
}

function writeLogs(d: DriverResult, system: RatingSystem) {
  const dir = path.join(LOGS, d.id, system);
  fs.mkdirSync(dir, { recursive: true });
  for (const key of RATING_KEYS as RatingKey[]) {
    if (d.logs[key].length === 0) continue;
    const logs = d.logs[key].map((l) => ({ ...l, delta: r1(l.delta), rating: r1(l.rating) }));
    fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(logs));
  }
}

function main() {
  const jolpica = readDir<JolpicaSeason>(path.join(RAW, "jolpica"));
  const openf1 = readDir<OpenF1Season>(path.join(RAW, "openf1"));
  if (jolpica.length === 0) throw new Error("No raw data; run scripts/fetch-data.ts first");

  const data = normalize(jolpica, openf1);
  const result = computeRatings(data.events, DEFAULT_CONFIG);
  const recentred: EngineResult = computeRatings(data.events, RECENTRED_CONFIG);
  const events = data.events;
  const last = events[result.lastEventIdx];

  const summaries: Record<string, DriverSummary> = {};
  fs.rmSync(path.join(OUT, "drivers"), { recursive: true, force: true });
  fs.rmSync(LOGS, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const d of Object.values(result.drivers)) {
    if (d.ratings.overall.matches === 0) continue; // never had a teammate to compare against
    const info = data.drivers[d.id];
    const seasons = d.logs.overall.map((l) => l.season);
    const latestTeam = d.teams.at(-1)!;

    const base = systemView(d, events);
    const rc = recentred.drivers[d.id];

    summaries[d.id] = {
      id: d.id,
      givenName: info.givenName,
      familyName: info.familyName,
      nationality: info.nationality,
      code: info.code,
      headshot: data.headshots[d.id],
      teamId: latestTeam,
      teamName: data.teams[latestTeam]?.name ?? latestTeam,
      teamColour: data.teamColours[latestTeam],
      teams: d.teams.map((t) => data.teams[t]?.name ?? t),
      firstSeason: Math.min(...seasons),
      lastSeason: Math.max(...seasons),
      eventsAtNumberOne: base.eventsAtNumberOne,
      seasonRecord: d.seasonRecord,
      ratings: base.ratings,
      recentred: systemView(rc, events),
    };

    writeLogs(d, "default");
    writeLogs(rc, "recentred");
  }

  const summary: SiteSummary = {
    generatedAt: new Date().toISOString(),
    lastEvent: last ? { season: last.season, round: last.round, name: last.name, date: last.date } : null,
    currentGrid: result.currentGrid.filter((id) => summaries[id]),
    drivers: summaries,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary));
  console.log(
    `${events.length} events, ${Object.keys(summaries).length} rated drivers, last: ${last?.season} ${last?.name}`,
  );
}

main();
