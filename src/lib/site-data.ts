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
