// Normalized F1 data the rating engine works on, independent of any API.

/** Q = single-session qualifying (1994–2005). Q1–Q3 / SQ1–SQ3 = knockout segments. */
export type SessionKind =
  | "Q"
  | "Q1"
  | "Q2"
  | "Q3"
  | "RACE"
  | "SPRINT"
  | "SQ1"
  | "SQ2"
  | "SQ3";

export type Category = "qualifying" | "race" | "sprint" | "sprintQualifying";
export type RatingKey = "overall" | Category;

export const CATEGORIES: Category[] = ["qualifying", "race", "sprint", "sprintQualifying"];
export const RATING_KEYS: RatingKey[] = ["overall", ...CATEGORIES];

export const SESSION_CATEGORY: Record<SessionKind, Category> = {
  Q: "qualifying",
  Q1: "qualifying",
  Q2: "qualifying",
  Q3: "qualifying",
  RACE: "race",
  SPRINT: "sprint",
  SQ1: "sprintQualifying",
  SQ2: "sprintQualifying",
  SQ3: "sprintQualifying",
};

export interface Entry {
  driverId: string;
  teamId: string;
  /** Classified position in this session, if any. */
  position: number | null;
  /** Lap time in ms, for qualifying segments. */
  timeMs?: number | null;
  /** Races/sprints: took the chequered flag (finished or lapped). */
  finished?: boolean;
}

export interface Session {
  kind: SessionKind;
  entries: Entry[];
}

export interface RaceEvent {
  season: number;
  round: number;
  name: string;
  /** Race date, YYYY-MM-DD. */
  date: string;
  /** Sessions in the order they were run. */
  sessions: Session[];
  /** Which session types this weekend's format has data for, once complete. */
  format: { qualifying: boolean; sprint: boolean; sprintQualifying: boolean };
}

export interface DriverInfo {
  id: string;
  givenName: string;
  familyName: string;
  nationality: string;
  code?: string;
}

export interface TeamInfo {
  id: string;
  name: string;
}
