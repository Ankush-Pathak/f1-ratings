// Shapes of the generated data files the site reads (data/generated/).

import type { LogEntry } from "./engine";
import type { RatingKey } from "./model";

export interface EventRef {
  season: number;
  round: number;
  name: string;
  date: string;
}

export interface RatingView {
  current: number;
  peak: number;
  peakEvent: EventRef | null;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  trend: number;
}

/** "default": additive career points. "recentred": each weekend's grid averages 1000. */
export type RatingSystem = "default" | "recentred";
export const RATING_SYSTEMS: RatingSystem[] = ["default", "recentred"];

export interface SystemView {
  ratings: Record<RatingKey, RatingView>;
  eventsAtNumberOne: number;
}

export interface DriverSummary {
  id: string;
  givenName: string;
  familyName: string;
  nationality: string;
  code?: string;
  headshot?: string;
  teamId: string;
  teamName: string;
  teamColour?: string;
  teams: string[];
  firstSeason: number;
  lastSeason: number;
  eventsAtNumberOne: number;
  seasonRecord: { wins: number; losses: number; draws: number };
  /** Default-system ratings. */
  ratings: Record<RatingKey, RatingView>;
  recentred: SystemView;
}

/** A driver's rank per rating: all-time (by peak) and, for current drivers, on today's grid. */
export type DriverRanks = Record<RatingSystem, Record<RatingKey, { allTime: number | null; grid: number | null }>>;

export function driverRanks(summary: SiteSummary, id: string): DriverRanks {
  const grid = new Set(summary.currentGrid);
  const all = Object.values(summary.drivers);
  const out = {} as DriverRanks;
  for (const system of RATING_SYSTEMS) {
    out[system] = {} as DriverRanks[RatingSystem];
    for (const key of ["overall", "qualifying", "race", "sprint", "sprintQualifying"] as RatingKey[]) {
      const r = (d: DriverSummary) => systemView(d, system).ratings[key];
      const rated = all.filter((d) => r(d).matches > 0);
      if (!rated.some((d) => d.id === id)) {
        out[system][key] = { allTime: null, grid: null };
        continue;
      }
      const allTime = [...rated].sort((a, b) => r(b).peak - r(a).peak).findIndex((d) => d.id === id) + 1;
      const onGrid = grid.has(id)
        ? rated
            .filter((d) => grid.has(d.id))
            .sort((a, b) => r(b).current - r(a).current)
            .findIndex((d) => d.id === id) + 1
        : null;
      out[system][key] = { allTime, grid: onGrid };
    }
  }
  return out;
}

/** A driver's ratings in either system. */
export function systemView(d: DriverSummary, system: RatingSystem): SystemView {
  return system === "recentred" ? d.recentred : { ratings: d.ratings, eventsAtNumberOne: d.eventsAtNumberOne };
}

export interface SiteSummary {
  generatedAt: string;
  lastEvent: EventRef | null;
  currentGrid: string[];
  drivers: Record<string, DriverSummary>;
}

/** URL of one driver's log for one rating (public/data/drivers/<id>/<system>/<key>.json). */
export const logUrl = (basePath: string, id: string, system: RatingSystem, key: RatingKey) =>
  `${basePath}/data/drivers/${id}/${system}/${key}.json`;

export type { LogEntry };

/** One teammate match in the prediction corner. "a" is the alphabetically first driver of the pair. */
export interface PredictionMatch {
  season: number;
  round: number;
  event: string;
  date: string;
  session: LogEntry["session"];
  a: string;
  b: string;
  /** Elo's pre-match win chance for a. */
  pA: number;
  result: LogEntry["result"]; // from a's side
}

/** A teammate pair's season: Elo's expected head-to-head vs what happened. */
export interface PredictionPair {
  season: number;
  teamId: string;
  teamName: string;
  teamColour?: string;
  a: string;
  b: string;
  matches: number;
  /** Expected score for a (wins + half of draws). */
  expectedA: number;
  winsA: number;
  winsB: number;
  draws: number;
  /** First season these two were teammates. */
  newPairing: boolean;
}

/** Headline sessions a weekend preview calls: final qualifying order, sprint quali, sprint, race. */
export type HeadlineSession = "Q" | "SQ" | "SPRINT" | "RACE";
export const HEADLINE_LABEL: Record<HeadlineSession, string> = {
  Q: "Qualifying",
  SQ: "Sprint Quali",
  SPRINT: "Sprint",
  RACE: "Race",
};

/** One pre-weekend call: Elo's chance for a, and who actually came out ahead (null = no result). */
export interface WeekendCall {
  teamId: string;
  a: string;
  b: string;
  session: HeadlineSession;
  pA: number;
  winner: string | null;
}

export interface WeekendDetail {
  round: number;
  calls: WeekendCall[];
}

/** How Elo's pre-weekend calls did over one weekend. */
export interface WeekendScore {
  round: number;
  name: string;
  date: string;
  calls: number;
  correct: number;
}

export interface CallRecord {
  called: number;
  favouriteWins: number;
}

export interface PreviewPair {
  teamId: string;
  teamName: string;
  teamColour?: string;
  a: string;
  b: string;
  /** Win chance for a in each headline session this weekend. */
  odds: Partial<Record<HeadlineSession, number>>;
  /** Chance a (or b) beats the other in every headline session, treating them as independent. */
  sweepA: number;
  sweepB: number;
}

export interface NextPreview {
  season: number;
  round: number;
  name: string;
  date: string;
  sprint: boolean;
  sessions: HeadlineSession[];
  pairs: PreviewPair[];
}

export interface PredictionSeason {
  season: number;
  matches: number;
  /** Matches with a favourite (pA ≠ 0.5) where the favourite won. */
  favouriteWins: number;
  called: number;
  /** Least likely results first. */
  upsets: PredictionMatch[];
  pairs: PredictionPair[];
  /** Match calls split by whether the pair was new that season. */
  newPairings: CallRecord;
  established: CallRecord;
  /** Pre-weekend previews graded against what happened, in calendar order. */
  weekends: WeekendScore[];
}

export interface PredictionSummary {
  seasons: PredictionSeason[];
  next: NextPreview | null;
}

export const predictionMatchesUrl = (basePath: string, season: number) =>
  `${basePath}/data/predictions/${season}.json`;
export const predictionWeekendsUrl = (basePath: string, season: number) =>
  `${basePath}/data/predictions/${season}-weekends.json`;
