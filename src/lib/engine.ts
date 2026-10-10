// Teammate head-to-head Elo engine. Pure: events in, ratings + logs out.

import { eloDelta } from "./elo";
import {
  RATING_KEYS,
  SESSION_CATEGORY,
  type Entry,
  type RaceEvent,
  type RatingKey,
  type Session,
  type SessionKind,
} from "./model";

export interface EngineConfig {
  /** Rating of the very first drivers, before any grid average exists. */
  startRating: number;
  /** New drivers start at the average rating of the previous event's grid instead of startRating. */
  seedAtGridAverage: boolean;
  /** Max points one full-weight match can move a rating. */
  k: number;
  /**
   * Total Overall-rating stake per weekend. Sessions are scaled so every weekend carries this,
   * whatever data its era has (a 1988 race with no qualifying data counts double).
   * null disables the scaling.
   */
  weekendStake: number | null;
  /**
   * After each event, shift that event's drivers equally so their average is startRating.
   * Stops long-run inflation and makes a rating mean "how far above the field of the day".
   */
  recentre: boolean;
  /** Trend = rating change over this many most recent events. */
  trendEvents: number;
}

/** Default, additive ratings: points accumulate over a career; everyone starts at 1000. */
export const DEFAULT_CONFIG: EngineConfig = {
  startRating: 1000,
  seedAtGridAverage: false,
  k: 32,
  weekendStake: 2,
  recentre: false,
  trendEvents: 3,
};

/** Re-centred ratings: each weekend's grid averages 1000, so ratings compare across eras. */
export const RECENTRED_CONFIG: EngineConfig = { ...DEFAULT_CONFIG, seedAtGridAverage: true, recentre: true };

/** Weight of each session in the Overall rating; a weekend's quali totals 1, like the race. */
export const OVERALL_WEIGHT: Record<SessionKind, number> = {
  RACE: 1,
  Q: 1,
  Q1: 1 / 3,
  Q2: 1 / 3,
  Q3: 1 / 3,
  SPRINT: 0.5,
  SQ1: 1 / 6,
  SQ2: 1 / 6,
  SQ3: 1 / 6,
};

/** Weight within the session's own category rating; a weekend of each category totals 1. */
export const CATEGORY_WEIGHT: Record<SessionKind, number> = {
  RACE: 1,
  Q: 1,
  Q1: 1 / 3,
  Q2: 1 / 3,
  Q3: 1 / 3,
  SPRINT: 1,
  SQ1: 1 / 3,
  SQ2: 1 / 3,
  SQ3: 1 / 3,
};

export type MatchResult = "W" | "L" | "D";

export interface LogEntry {
  season: number;
  round: number;
  event: string;
  date: string;
  session: SessionKind;
  teammateId: string;
  result: MatchResult;
  delta: number;
  /** Rating after this update. */
  rating: number;
}

export interface RatingSummary {
  current: number;
  peak: number;
  /** Event index (into the events array) where the peak was reached; -1 if never rated. */
  peakEventIdx: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** Rating change over the last `trendEvents` events; 0 if the driver wasn't in them. */
  trend: number;
}

export interface DriverResult {
  id: string;
  ratings: Record<RatingKey, RatingSummary>;
  logs: Record<RatingKey, LogEntry[]>;
  /** Events after which this driver had the highest Overall rating among that event's entrants. */
  eventsAtNumberOne: number;
  /** Teams driven for, in first-seen order. */
  teams: string[];
  /** Overall-rating head-to-head this season (latest season in the data). */
  seasonRecord: { wins: number; losses: number; draws: number };
}

export interface EngineResult {
  drivers: Record<string, DriverResult>;
  /** Drivers with an entry in the most recent event. */
  currentGrid: string[];
  lastEventIdx: number;
}

/**
 * Decides a head-to-head in one session. Returns 1/0.5/0 from a's view,
 * or null when the match doesn't count (DNF, no time, no position).
 */
export function compareEntries(kind: SessionKind, a: Entry, b: Entry): number | null {
  switch (kind) {
    case "RACE":
    case "SPRINT":
      if (!a.finished || !b.finished || a.position == null || b.position == null) return null;
      return a.position < b.position ? 1 : a.position > b.position ? 0 : 0.5;
    case "Q":
      if (a.position == null || b.position == null) return null;
      return a.position < b.position ? 1 : a.position > b.position ? 0 : 0.5;
    default: {
      // Knockout segment: both must have set a time in it.
      if (a.timeMs == null || b.timeMs == null) return null;
      if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? 1 : 0;
      // Identical times: the official order (who set it first) decides.
      if (a.position != null && b.position != null && a.position !== b.position) {
        return a.position < b.position ? 1 : 0;
      }
      return 0.5;
    }
  }
}

function sortKey(kind: SessionKind, e: Entry): number {
  if (kind !== "RACE" && kind !== "SPRINT" && kind !== "Q" && e.timeMs != null) return e.timeMs;
  return e.position ?? Number.POSITIVE_INFINITY;
}

/** One entry per driver (their best, if listed twice), grouped by team. */
export function teamsInSession(session: Session): Map<string, Entry[]> {
  const best = new Map<string, Entry>();
  for (const e of session.entries) {
    const prev = best.get(e.driverId);
    if (!prev || sortKey(session.kind, e) < sortKey(session.kind, prev)) best.set(e.driverId, e);
  }
  const teams = new Map<string, Entry[]>();
  for (const e of best.values()) {
    const list = teams.get(e.teamId) ?? [];
    list.push(e);
    teams.set(e.teamId, list);
  }
  return teams;
}

function emptySummary(start: number): RatingSummary {
  return { current: start, peak: start, peakEventIdx: -1, matches: 0, wins: 0, losses: 0, draws: 0, trend: 0 };
}

export function computeRatings(events: RaceEvent[], config: EngineConfig = DEFAULT_CONFIG): EngineResult {
  const drivers: Record<string, DriverResult> = {};
  // Entrants of each event.
  const entrantsByEvent: Set<string>[] = [];
  // Rating at the end of each event a driver was rated in, per key (for trends).
  const history: Record<string, Record<RatingKey, { eventIdx: number; rating: number }[]>> = {};
  const lastSeason = events.length ? events[events.length - 1].season : 0;

  const driver = (id: string): DriverResult => {
    if (!drivers[id]) {
      const ratings = {} as Record<RatingKey, RatingSummary>;
      const logs = {} as Record<RatingKey, LogEntry[]>;
      for (const key of RATING_KEYS) {
        ratings[key] = emptySummary(config.startRating);
        logs[key] = [];
      }
      history[id] = Object.fromEntries(RATING_KEYS.map((k) => [k, []])) as unknown as Record<
        RatingKey,
        { eventIdx: number; rating: number }[]
      >;
      drivers[id] = {
        id,
        ratings,
        logs,
        eventsAtNumberOne: 0,
        teams: [],
        seasonRecord: { wins: 0, losses: 0, draws: 0 },
      };
    }
    return drivers[id];
  };

  // Average rating per key among the previous event's rated entrants: where newcomers start.
  const gridAverage = (prevEntrants: Set<string> | undefined): Record<RatingKey, number> => {
    const avg = {} as Record<RatingKey, number>;
    for (const key of RATING_KEYS) {
      const rated = [...(prevEntrants ?? [])].map((id) => drivers[id].ratings[key]).filter((r) => r.matches > 0);
      avg[key] = rated.length ? rated.reduce((s, r) => s + r.current, 0) / rated.length : config.startRating;
    }
    return avg;
  };
  let prevEntrants: Set<string> | undefined;

  events.forEach((ev, eventIdx) => {
    const entrants = new Set<string>();
    const seed = gridAverage(prevEntrants);
    const scale = config.weekendStake == null ? 1 : config.weekendStake / expectedWeekendWeight(ev);

    for (const session of ev.sessions) {
      const category = SESSION_CATEGORY[session.kind];
      const keys: [RatingKey, number][] = [
        ["overall", OVERALL_WEIGHT[session.kind] * scale],
        [category, CATEGORY_WEIGHT[session.kind]],
      ];

      for (const [teamId, members] of teamsInSession(session)) {
        for (const m of members) {
          entrants.add(m.driverId);
          const d = driver(m.driverId);
          if (!d.teams.includes(teamId)) d.teams.push(teamId);
        }
        if (members.length < 2) continue;
        // Split the stake so a driver with several teammates risks no more than one match's worth.
        const split = 1 / (members.length - 1);

        for (const [key, weight] of keys) {
          // A driver's first match in a rating: start them at the grid average.
          if (config.seedAtGridAverage) {
            for (const m of members) {
              const r = drivers[m.driverId].ratings[key];
              if (r.matches === 0) r.current = r.peak = seed[key];
            }
          }
          // All pairs use ratings from before this session.
          const before = new Map(members.map((m) => [m.driverId, drivers[m.driverId].ratings[key].current]));
          const deltas: { id: string; mate: string; result: MatchResult; delta: number }[] = [];

          for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
              const a = members[i];
              const b = members[j];
              const score = compareEntries(session.kind, a, b);
              if (score == null) continue;
              const k = config.k * weight * split;
              const delta = eloDelta(before.get(a.driverId)!, before.get(b.driverId)!, score, k);
              const resA: MatchResult = score === 1 ? "W" : score === 0 ? "L" : "D";
              const resB: MatchResult = score === 1 ? "L" : score === 0 ? "W" : "D";
              deltas.push({ id: a.driverId, mate: b.driverId, result: resA, delta });
              deltas.push({ id: b.driverId, mate: a.driverId, result: resB, delta: -delta });
            }
          }

          for (const { id, mate, result, delta } of deltas) {
            const d = drivers[id];
            const s = d.ratings[key];
            s.current += delta;
            s.matches++;
            if (result === "W") s.wins++;
            else if (result === "L") s.losses++;
            else s.draws++;
            d.logs[key].push({
              season: ev.season,
              round: ev.round,
              event: ev.name,
              date: ev.date,
              session: session.kind,
              teammateId: mate,
              result,
              delta,
              rating: s.current,
            });
            if (key === "overall" && ev.season === lastSeason) {
              if (result === "W") d.seasonRecord.wins++;
              else if (result === "L") d.seasonRecord.losses++;
              else d.seasonRecord.draws++;
            }
          }
        }
      }
    }

    // End of the weekend: re-centre the grid, then record peaks and history on the shifted scale.
    for (const key of RATING_KEYS) {
      const rated = [...entrants].filter((id) => drivers[id].ratings[key].matches > 0);
      if (rated.length === 0) continue;
      const mean = rated.reduce((sum, id) => sum + drivers[id].ratings[key].current, 0) / rated.length;
      const shift = config.recentre ? config.startRating - mean : 0;
      for (const id of rated) {
        const s = drivers[id].ratings[key];
        s.current += shift;
        // This weekend's log entries show ratings after the shift.
        const logs = drivers[id].logs[key];
        for (let i = logs.length - 1; i >= 0 && logs[i].season === ev.season && logs[i].round === ev.round; i--) {
          logs[i].rating += shift;
        }
        if (s.peakEventIdx === -1 || s.current > s.peak) {
          s.peak = s.current;
          s.peakEventIdx = eventIdx;
        }
        history[id][key].push({ eventIdx, rating: s.current });
      }
    }

    // Who leads among this event's entrants?
    let leader: string | null = null;
    for (const id of entrants) {
      if (!leader || drivers[id].ratings.overall.current > drivers[leader].ratings.overall.current) leader = id;
    }
    if (leader) drivers[leader].eventsAtNumberOne++;

    entrantsByEvent.push(entrants);
    prevEntrants = entrants;
  });

  const lastEventIdx = events.length - 1;
  const currentGrid = lastEventIdx >= 0 ? [...entrantsByEvent[lastEventIdx]] : [];

  // Trends: change over the last N events, per rating key, for drivers who took part in them.
  const trendStart = lastEventIdx - config.trendEvents + 1;
  if (trendStart >= 0) {
    const recent = new Set<string>();
    for (let i = trendStart; i <= lastEventIdx; i++) for (const id of entrantsByEvent[i]) recent.add(id);
    for (const id of recent) {
      const d = drivers[id];
      for (const key of RATING_KEYS) {
        const h = history[id][key];
        if (h.length === 0) continue;
        // Compare with the rating just before the window; newcomers in the window, with where they started.
        const before = h.filter((p) => p.eventIdx < trendStart).at(-1);
        const firstLog = d.logs[key].find((l) => isAtOrAfter(l, events[trendStart]));
        const baseline = before?.rating ?? (firstLog ? firstLog.rating - firstLog.delta : d.ratings[key].current);
        d.ratings[key].trend = d.ratings[key].current - baseline;
      }
    }
  }

  return { drivers, currentGrid, lastEventIdx };
}

/**
 * Overall weight a weekend of this event's format carries in full: qualifying (1994+), race,
 * and sprint + sprint qualifying where the weekend had them. Based on the format, not on which
 * sessions have run, so a weekend in progress isn't scaled up.
 */
export function expectedWeekendWeight(ev: RaceEvent): number {
  const f = ev.format;
  return (f.qualifying ? 1 : 0) + 1 + (f.sprint ? 0.5 : 0) + (f.sprintQualifying ? 0.5 : 0);
}

function isAtOrAfter(l: LogEntry, ev: RaceEvent): boolean {
  return l.season > ev.season || (l.season === ev.season && l.round >= ev.round);
}
