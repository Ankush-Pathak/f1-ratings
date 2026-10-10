// Recomputes every rating from the cached raw data and writes the site's data files.
//   npx tsx scripts/build-ratings.ts

import fs from "node:fs";
import path from "node:path";
import { computeRatings, DEFAULT_CONFIG, type DriverResult, type EngineResult, RECENTRED_CONFIG } from "../src/lib/engine";
import { normalize } from "../src/lib/normalize";
import type { JolpicaSeason } from "../src/lib/sources/jolpica";
import type { OpenF1Season } from "../src/lib/sources/openf1";
import { RATING_KEYS, type RatingKey } from "../src/lib/model";
import { expectedScore } from "../src/lib/elo";
import type { UpcomingEvent } from "../src/lib/normalize";
import type {
  CallRecord,
  DriverSummary,
  HeadlineSession,
  NextPreview,
  PreviewPair,
  WeekendCall,
  WeekendDetail,
  WeekendScore,
  PredictionMatch,
  PredictionPair,
  PredictionSeason,
  PredictionSummary,
  RatingSystem,
  SiteSummary,
  SystemView,
} from "../src/lib/site-data";
import type { RaceEvent } from "../src/lib/model";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data", "generated");
// Per-driver logs are served as static files and fetched by the driver page one rating at a time.
const LOGS = path.join(ROOT, "public", "data", "drivers");
const PREDICTIONS = path.join(ROOT, "public", "data", "predictions");

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

// Ratings all start at 1000 in 1982, so the first two seasons' calls are mostly coin flips.
const PREDICTION_FIRST_SEASON = 1984;
const UPSET_SESSIONS = new Set<RaceEvent["sessions"][number]["kind"]>(["Q", "Q3", "SQ3", "SPRINT", "RACE"]);

const HEADLINE_CATEGORY: Record<HeadlineSession, RatingKey> = {
  Q: "qualifying",
  SQ: "sprintQualifying",
  SPRINT: "sprint",
  RACE: "race",
};

/** A driver's rating in one category just before an event (start rating if none yet). Logs are in date order. */
function ratingBefore(result: EngineResult, id: string, key: RatingKey, season: number, round: number): number {
  const logs = result.drivers[id]?.logs[key] ?? [];
  // Binary search for the last entry before (season, round).
  let lo = 0;
  let hi = logs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const l = logs[mid];
    if (l.season < season || (l.season === season && l.round < round)) lo = mid + 1;
    else hi = mid;
  }
  return lo === 0 ? DEFAULT_CONFIG.startRating : logs[lo - 1].rating;
}

/** Final order of each headline session at an event: position per driver, or null if they didn't finish. */
function headlineOutcomes(ev: RaceEvent): Partial<Record<HeadlineSession, Map<string, number | null>>> {
  const out: Partial<Record<HeadlineSession, Map<string, number | null>>> = {};
  const q = ev.sessions.find((s) => s.kind === "Q" || s.kind === "Q1"); // Q1 entries carry the final quali position
  const sq = ev.sessions.find((s) => s.kind === "SQ1");
  const map = (s: RaceEvent["sessions"][number], needFinish: boolean) =>
    new Map(s.entries.map((e) => [e.driverId, needFinish && !e.finished ? null : e.position]));
  if (q) out.Q = map(q, false);
  if (sq) out.SQ = map(sq, false);
  for (const kind of ["SPRINT", "RACE"] as const) {
    const s = ev.sessions.find((x) => x.kind === kind);
    if (s) out[kind] = map(s, true);
  }
  return out;
}

function eventPairs(ev: RaceEvent): { teamId: string; a: string; b: string }[] {
  const teams = new Map<string, Set<string>>();
  for (const s of ev.sessions) for (const e of s.entries) {
    const t = teams.get(e.teamId) ?? new Set<string>();
    t.add(e.driverId);
    teams.set(e.teamId, t);
  }
  const pairs: { teamId: string; a: string; b: string }[] = [];
  for (const [teamId, ids] of teams) {
    const list = [...ids].sort();
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push({ teamId, a: list[i], b: list[j] });
  }
  return pairs;
}

/** Grades Elo's pre-weekend calls (from ratings before the weekend) against each headline session's result. */
function scoreWeekend(result: EngineResult, ev: RaceEvent): { score: WeekendScore; detail: WeekendDetail } {
  const outcomes = headlineOutcomes(ev);
  let calls = 0;
  let correct = 0;
  const detail: WeekendCall[] = [];
  for (const { teamId, a, b } of eventPairs(ev)) {
    for (const [session, order] of Object.entries(outcomes) as [HeadlineSession, Map<string, number | null>][]) {
      if (!order.has(a) || !order.has(b)) continue;
      const pa = order.get(a);
      const pb = order.get(b);
      const key = HEADLINE_CATEGORY[session];
      const pA = expectedScore(ratingBefore(result, a, key, ev.season, ev.round), ratingBefore(result, b, key, ev.season, ev.round));
      const decided = pa != null && pb != null && pa !== pb;
      detail.push({ teamId, a, b, session, pA: Math.round(pA * 1000) / 1000, winner: decided ? (pa! < pb! ? a : b) : null });
      if (!decided || pA === 0.5) continue;
      calls++;
      if ((pA > 0.5) === (pa! < pb!)) correct++;
    }
  }
  return { score: { round: ev.round, name: ev.name, date: ev.date, calls, correct }, detail: { round: ev.round, calls: detail } };
}

/** Odds for the next weekend from current ratings, for every pairing on the latest grid. */
function buildPreview(
  result: EngineResult,
  events: RaceEvent[],
  upcoming: UpcomingEvent | null,
  teamNames: Record<string, string>,
  teamColours: Record<string, string>,
): NextPreview | null {
  const last = events.at(-1);
  if (!upcoming || !last) return null;
  const sessions: HeadlineSession[] = upcoming.sprint ? ["SQ", "SPRINT", "Q", "RACE"] : ["Q", "RACE"];
  const pairs: PreviewPair[] = eventPairs(last).map(({ teamId, a, b }) => {
    const odds: PreviewPair["odds"] = {};
    let sweepA = 1;
    let sweepB = 1;
    for (const s of sessions) {
      const key = HEADLINE_CATEGORY[s];
      const pA = expectedScore(result.drivers[a].ratings[key].current, result.drivers[b].ratings[key].current);
      odds[s] = Math.round(pA * 1000) / 1000;
      sweepA *= pA;
      sweepB *= 1 - pA;
    }
    return {
      teamId,
      teamName: teamNames[teamId] ?? teamId,
      teamColour: teamColours[teamId],
      a,
      b,
      odds,
      sweepA: Math.round(sweepA * 1000) / 1000,
      sweepB: Math.round(sweepB * 1000) / 1000,
    };
  });
  return { ...upcoming, sessions, pairs };
}

/** Elo's pre-match calls vs outcomes for every teammate match in the last few seasons (default ratings). */
function buildPredictions(
  result: EngineResult,
  events: RaceEvent[],
  upcoming: UpcomingEvent | null,
  teamNames: Record<string, string>,
  teamColours: Record<string, string>,
): PredictionSummary {
  const first = PREDICTION_FIRST_SEASON;

  // Which team each driver drove for at each event.
  const teamAt = new Map<string, string>();
  for (const ev of events) {
    if (ev.season < first) continue;
    for (const s of ev.sessions) for (const e of s.entries) teamAt.set(`${ev.season}|${ev.round}|${e.driverId}`, e.teamId);
  }

  // A pairing is "new" in a season if, when the two first meet that season, either driver's
  // previous teammate was someone else: a line-up change, a mid-season swap, or a reunion.
  const prevMate = (id: string, season: number, round: number): string | null => {
    let mate: string | null = null;
    for (const l of result.drivers[id]?.logs.overall ?? []) {
      if (l.season > season || (l.season === season && l.round >= round)) break;
      mate = l.teammateId;
    }
    return mate;
  };
  const isNewPairing = new Map<string, boolean>(); // `${season}|${a}|${b}`

  const bySeason = new Map<number, PredictionMatch[]>();
  for (const d of Object.values(result.drivers)) {
    for (const l of d.logs.overall) {
      // Each match is logged for both drivers; keep the copy where this driver sorts first.
      if (l.season < first || d.id > l.teammateId) continue;
      const list = bySeason.get(l.season) ?? [];
      list.push({
        season: l.season,
        round: l.round,
        event: l.event,
        date: l.date,
        session: l.session,
        a: d.id,
        b: l.teammateId,
        pA: Math.round(l.expected * 1000) / 1000,
        result: l.result,
      });
      bySeason.set(l.season, list);
    }
  }

  const seasons: PredictionSeason[] = [];
  fs.mkdirSync(PREDICTIONS, { recursive: true });
  for (const [season, matches] of [...bySeason].sort((x, y) => y[0] - x[0])) {
    matches.sort((x, y) => x.date.localeCompare(y.date) || x.round - y.round);
    fs.writeFileSync(path.join(PREDICTIONS, `${season}.json`), JSON.stringify(matches));

    const weekends = events
      .filter((e) => e.season === season)
      .map((e) => scoreWeekend(result, e))
      .filter((w) => w.score.calls > 0);
    fs.writeFileSync(path.join(PREDICTIONS, `${season}-weekends.json`), JSON.stringify(weekends.map((w) => w.detail)));

    const pairs = new Map<string, PredictionPair>();
    let favouriteWins = 0;
    let called = 0;
    const newPairings: CallRecord = { called: 0, favouriteWins: 0 };
    const established: CallRecord = { called: 0, favouriteWins: 0 };
    for (const m of matches) {
      const pairKey = `${season}|${m.a}|${m.b}`;
      if (!isNewPairing.has(pairKey)) {
        // Matches are in date order, so this is the pair's first meeting of the season.
        isNewPairing.set(pairKey, prevMate(m.a, m.season, m.round) !== m.b || prevMate(m.b, m.season, m.round) !== m.a);
      }
      const isNew = isNewPairing.get(pairKey)!;
      const teamId = teamAt.get(`${m.season}|${m.round}|${m.a}`) ?? "";
      const key = `${teamId}|${m.a}|${m.b}`;
      const p = pairs.get(key) ?? {
        season,
        teamId,
        teamName: teamNames[teamId] ?? teamId,
        teamColour: teamColours[teamId],
        a: m.a,
        b: m.b,
        matches: 0,
        expectedA: 0,
        winsA: 0,
        winsB: 0,
        draws: 0,
        newPairing: isNew,
      };
      p.matches++;
      p.expectedA += m.pA;
      if (m.result === "W") p.winsA++;
      else if (m.result === "L") p.winsB++;
      else p.draws++;
      pairs.set(key, p);
      if (m.pA !== 0.5 && m.result !== "D") {
        const hit = (m.pA > 0.5) === (m.result === "W");
        const bucket = isNew ? newPairings : established;
        called++;
        bucket.called++;
        if (hit) {
          favouriteWins++;
          bucket.favouriteWins++;
        }
      }
    }
    // Probability Elo gave the eventual winner; lowest first. Only sessions where everyone is
    // flat out: early knockout segments (Q1/Q2, SQ1/SQ2) often see top drivers just doing enough.
    const winnerChance = (m: PredictionMatch) => (m.result === "W" ? m.pA : 1 - m.pA);
    const upsets = matches
      .filter((m) => m.result !== "D" && UPSET_SESSIONS.has(m.session))
      .sort((x, y) => winnerChance(x) - winnerChance(y))
      .slice(0, 5);
    seasons.push({
      season,
      matches: matches.length,
      favouriteWins,
      called,
      upsets,
      pairs: [...pairs.values()]
        .map((p) => ({ ...p, expectedA: Math.round(p.expectedA * 10) / 10 }))
        .sort((x, y) => y.matches - x.matches),
      newPairings,
      established,
      weekends: weekends.map((w) => w.score),
    });
  }
  return { seasons, next: buildPreview(result, events, upcoming, teamNames, teamColours) };
}

function main() {
  const jolpica = readDir<JolpicaSeason>(path.join(RAW, "jolpica"));
  const openf1 = readDir<OpenF1Season>(path.join(RAW, "openf1")).filter((s) => typeof s.season === "number");
  const missingFile = path.join(RAW, "openf1", "missing-headshots.json");
  const missingHeadshots = new Set<string>(fs.existsSync(missingFile) ? JSON.parse(fs.readFileSync(missingFile, "utf8")) : []);
  if (jolpica.length === 0) throw new Error("No raw data; run scripts/fetch-data.ts first");

  const data = normalize(jolpica, openf1, missingHeadshots);
  const result = computeRatings(data.events, DEFAULT_CONFIG);
  const recentred: EngineResult = computeRatings(data.events, RECENTRED_CONFIG);
  const events = data.events;
  const last = events[result.lastEventIdx];

  const summaries: Record<string, DriverSummary> = {};
  fs.rmSync(path.join(OUT, "drivers"), { recursive: true, force: true });
  fs.rmSync(LOGS, { recursive: true, force: true });
  fs.rmSync(PREDICTIONS, { recursive: true, force: true });
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
  const teamNames = Object.fromEntries(Object.values(data.teams).map((t) => [t.id, t.name]));
  const predictions = buildPredictions(result, events, data.upcoming, teamNames, data.teamColours);
  fs.writeFileSync(path.join(OUT, "predictions.json"), JSON.stringify(predictions));
  console.log(
    `${events.length} events, ${Object.keys(summaries).length} rated drivers, last: ${last?.season} ${last?.name}`,
  );
}

main();
