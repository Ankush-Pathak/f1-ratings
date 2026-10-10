// Turns raw Jolpica + OpenF1 data into the engine's RaceEvents.

import type { DriverInfo, Entry, RaceEvent, Session, SessionKind, TeamInfo } from "./model";
import type { JDriver, JolpicaSeason, JQualifying, JRace, JResult, JSessionTime } from "./sources/jolpica";
import type { OpenF1Season, OSprintQualifying } from "./sources/openf1";

export interface UpcomingEvent {
  season: number;
  round: number;
  name: string;
  date: string;
  sprint: boolean;
}

export interface NormalizedData {
  events: RaceEvent[];
  /** The next scheduled weekend with no results yet, if any. */
  upcoming: UpcomingEvent | null;
  drivers: Record<string, DriverInfo>;
  teams: Record<string, TeamInfo>;
  headshots: Record<string, string>;
  teamColours: Record<string, string>;
}

/** Took the chequered flag. Status text is used because Jolpica says older status ids may change. */
export function isFinished(status: string | undefined): boolean {
  if (!status) return false;
  return status === "Finished" || status === "Lapped" || /^\+\d+ Laps?$/.test(status);
}

/** "1:27.689" or "87.689" → ms; anything else → null. */
export function parseLapTime(t: string | undefined): number | null {
  if (!t) return null;
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(t.trim());
  if (!m) return null;
  return Math.round(((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])) * 1000);
}

const toInt = (s: string | undefined): number | null => {
  const n = s == null ? NaN : Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const timestamp = (t: JSessionTime | undefined, fallback: string): string =>
  t ? `${t.date}T${t.time ?? "12:00:00Z"}` : fallback;

/** Order to use when two sessions share a timestamp. */
const TIE_ORDER: SessionKind[] = ["Q", "Q1", "Q2", "Q3", "SQ1", "SQ2", "SQ3", "SPRINT", "RACE"];

function raceEntries(results: JResult[] | undefined): Entry[] {
  return (results ?? [])
    .filter((r) => r.Constructor)
    .map((r) => ({
      driverId: r.Driver.driverId,
      teamId: r.Constructor!.constructorId,
      position: toInt(r.position),
      finished: isFinished(r.status),
    }));
}

function qualifyingSessions(season: number, rows: JQualifying[] | undefined): Session[] {
  if (!rows?.length || season < 1994) return [];
  const base = (q: JQualifying) => ({
    driverId: q.Driver.driverId,
    teamId: q.Constructor.constructorId,
    position: toInt(q.position),
  });
  if (season < 2006) return [{ kind: "Q", entries: rows.map(base) }];
  return (["Q1", "Q2", "Q3"] as const).map((kind) => ({
    kind,
    entries: rows.map((q) => ({ ...base(q), timeMs: parseLapTime(q[kind]) })),
  }));
}

/** Matches an OpenF1 sprint-qualifying session to a Jolpica round and maps car numbers to drivers. */
function sprintQualifyingSessions(sq: OSprintQualifying, race: JRace, sprintRows: JResult[]): Session[] {
  const byNumber = new Map<number, { driverId: string; teamId: string }>();
  for (const r of [...(race.Results ?? []), ...sprintRows]) {
    if (r.Constructor) byNumber.set(Number(r.number), { driverId: r.Driver.driverId, teamId: r.Constructor.constructorId });
  }
  return (["SQ1", "SQ2", "SQ3"] as const).map((kind, i) => ({
    kind,
    entries: sq.results.flatMap((res) => {
      const who = byNumber.get(res.driver_number);
      if (!who) return [];
      const d = Array.isArray(res.duration) ? res.duration[i] : null;
      return [{ ...who, position: res.position ?? null, timeMs: d == null ? null : Math.round(d * 1000) }];
    }),
  }));
}

function findSprintRound(sq: OSprintQualifying, schedule: JRace[]): JRace | undefined {
  const day = sq.session.date_start.slice(0, 10);
  const exact = schedule.find((r) => (r.SprintQualifying ?? r.SprintShootout)?.date === day);
  if (exact) return exact;
  // Fallback: the sprint weekend whose race is 0–3 days after the session.
  const t = Date.parse(day);
  return schedule.find((r) => r.Sprint && Date.parse(r.date) - t >= 0 && Date.parse(r.date) - t <= 3 * 86_400_000);
}

export function normalize(
  jolpica: JolpicaSeason[],
  openf1: OpenF1Season[],
  missingHeadshots: Set<string> = new Set(),
): NormalizedData {
  const drivers: Record<string, DriverInfo> = {};
  const teams: Record<string, TeamInfo> = {};
  const headshots: Record<string, string> = {};
  const teamColours: Record<string, string> = {};
  const events: RaceEvent[] = [];
  let upcoming: UpcomingEvent | null = null;

  const noteDriver = (d: JDriver) => {
    drivers[d.driverId] = {
      id: d.driverId,
      givenName: d.givenName,
      familyName: d.familyName,
      nationality: d.nationality,
      code: d.code,
    };
  };

  const openf1BySeason = new Map(openf1.map((s) => [s.season, s]));

  for (const season of [...jolpica].sort((a, b) => a.season - b.season)) {
    const results = new Map(season.results.map((r) => [r.round, r]));
    const quali = new Map(season.qualifying.map((r) => [r.round, r]));
    const sprint = new Map(season.sprint.map((r) => [r.round, r]));
    const sqByRound = new Map<string, OSprintQualifying>();
    for (const sq of openf1BySeason.get(season.season)?.sprintQualifying ?? []) {
      const round = findSprintRound(sq, season.schedule);
      if (round) sqByRound.set(round.round, sq);
    }

    for (const sched of season.schedule) {
      if (/indianapolis/i.test(sched.raceName)) continue;
      const raceAt = timestamp({ date: sched.date, time: sched.time }, `${sched.date}T12:00:00Z`);
      const timed: { at: string; session: Session }[] = [];

      const res = results.get(sched.round);
      const q = quali.get(sched.round);
      const spr = sprint.get(sched.round);
      const sq = sqByRound.get(sched.round);

      for (const r of [...(res?.Results ?? []), ...(spr?.SprintResults ?? [])]) noteDriver(r.Driver);
      for (const r of q?.QualifyingResults ?? []) noteDriver(r.Driver);
      for (const r of [...(res?.Results ?? []), ...(spr?.SprintResults ?? []), ...(q?.QualifyingResults ?? [])]) {
        if (r.Constructor) teams[r.Constructor.constructorId] = { id: r.Constructor.constructorId, name: r.Constructor.name };
      }

      for (const s of qualifyingSessions(season.season, q?.QualifyingResults)) {
        timed.push({ at: timestamp(sched.Qualifying, raceAt), session: s });
      }
      if (spr?.SprintResults?.length) {
        timed.push({ at: timestamp(sched.Sprint, raceAt), session: { kind: "SPRINT", entries: raceEntries(spr.SprintResults) } });
      }
      if (sq) {
        for (const s of sprintQualifyingSessions(sq, sched, spr?.SprintResults ?? [])) {
          timed.push({ at: sq.session.date_start, session: s });
        }
      }
      if (res?.Results?.length) timed.push({ at: raceAt, session: { kind: "RACE", entries: raceEntries(res.Results) } });

      const sessions = timed
        .filter((t) => t.session.entries.length > 0)
        .sort(
          (a, b) =>
            Date.parse(a.at) - Date.parse(b.at) ||
            TIE_ORDER.indexOf(a.session.kind) - TIE_ORDER.indexOf(b.session.kind),
        )
        .map((t) => t.session);
      if (sessions.length === 0) {
        // The first round without results after the last rated weekend is the next race.
        const lastDate = events.at(-1)?.date ?? "";
        if (!upcoming && sched.date > lastDate) {
          upcoming = { season: season.season, round: Number(sched.round), name: sched.raceName, date: sched.date, sprint: !!sched.Sprint };
        } else if (upcoming && sched.date < upcoming.date && sched.date > lastDate) {
          upcoming = { season: season.season, round: Number(sched.round), name: sched.raceName, date: sched.date, sprint: !!sched.Sprint };
        }
        continue;
      }

      const sprintWeekend = !!sched.Sprint;
      events.push({
        season: season.season,
        round: Number(sched.round),
        name: sched.raceName,
        date: sched.date,
        sessions,
        format: {
          qualifying: season.season >= 1994,
          sprint: sprintWeekend,
          // Our sprint-qualifying source (OpenF1) starts in 2023.
          sprintQualifying: sprintWeekend && season.season >= 2023,
        },
      });
    }

    // Photos and team colours: the latest season's data wins.
    const of1 = openf1BySeason.get(season.season);
    const lastRace = season.results.at(-1)?.Results ?? [];
    const byNumber = new Map(lastRace.map((r) => [Number(r.number), r]));
    for (const d of of1?.latestRaceDrivers ?? []) {
      const j = byNumber.get(d.driver_number);
      if (!j) continue;
      if (d.headshot_url && !missingHeadshots.has(d.headshot_url)) headshots[j.Driver.driverId] = d.headshot_url;
      if (d.team_colour && j.Constructor) teamColours[j.Constructor.constructorId] = `#${d.team_colour}`;
    }
  }

  // A round only counts as upcoming if no later round has results.
  if (upcoming && events.some((e) => e.date > upcoming!.date)) upcoming = null;
  return { events, upcoming, drivers, teams, headshots, teamColours };
}
