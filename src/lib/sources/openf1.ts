// OpenF1 client, used for sprint qualifying (Jolpica has none) and driver photos/team colours.
// Docs: openf1.org/docs. Free historical data from 2023; all access is blocked during live sessions.

import { getJson, type Throttle } from "./http";

const BASE = "https://api.openf1.org/v1";

// Free tier: 3 req/s and 30 req/min.
export const openf1Throttle: Throttle = { intervalMs: 2_100, last: 0 };

export interface OSession {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  is_cancelled?: boolean;
}

export interface OResult {
  driver_number: number;
  position: number | null;
  /** For qualifying-type sessions: [Q1, Q2, Q3] best laps in seconds. */
  duration: number | (number | null)[] | null;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
}

export interface ODriver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string | null;
  team_colour: string | null;
  headshot_url: string | null;
}

export interface OSprintQualifying {
  session: OSession;
  results: OResult[];
  drivers: ODriver[];
}

export interface OpenF1Season {
  season: number;
  fetchedAt: string;
  sprintQualifying: OSprintQualifying[];
  /** Drivers in the season's latest race (photos, team colours). */
  latestRaceDrivers: ODriver[];
}

const SQ_NAMES = new Set(["Sprint Qualifying", "Sprint Shootout"]);

export async function fetchOpenF1Season(season: number, cached?: OpenF1Season): Promise<OpenF1Season> {
  const sessions = await getJson<OSession[]>(`${BASE}/sessions?year=${season}`, openf1Throttle);
  const done = new Map((cached?.sprintQualifying ?? []).map((sq) => [sq.session.session_key, sq]));
  // Results can lag the session slightly; only fetch sessions that ended over an hour ago.
  const cutoff = Date.now() - 60 * 60 * 1000;
  const ended = (s: OSession) => !s.is_cancelled && new Date(s.date_end).getTime() < cutoff;

  const sprintQualifying: OSprintQualifying[] = [];
  for (const session of sessions.filter((s) => SQ_NAMES.has(s.session_name) && ended(s))) {
    const prev = done.get(session.session_key);
    if (prev && prev.results.length > 0) {
      sprintQualifying.push(prev);
      continue;
    }
    const results = await getJson<OResult[]>(`${BASE}/session_result?session_key=${session.session_key}`, openf1Throttle);
    const drivers = await getJson<ODriver[]>(`${BASE}/drivers?session_key=${session.session_key}`, openf1Throttle);
    sprintQualifying.push({ session, results, drivers });
  }

  const races = sessions.filter((s) => s.session_name === "Race" && ended(s));
  const latestRace = races.sort((a, b) => a.date_start.localeCompare(b.date_start)).at(-1);
  const latestRaceDrivers = latestRace
    ? await getJson<ODriver[]>(`${BASE}/drivers?session_key=${latestRace.session_key}`, openf1Throttle)
    : (cached?.latestRaceDrivers ?? []);

  return { season, fetchedAt: new Date().toISOString(), sprintQualifying, latestRaceDrivers };
}
