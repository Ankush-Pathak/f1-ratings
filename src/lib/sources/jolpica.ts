// Jolpica-F1 (Ergast-compatible) client. Docs: github.com/jolpica/jolpica-f1/tree/main/docs

import { getJson, type Throttle } from "./http";

const BASE = "https://api.jolpi.ca/ergast/f1";
const PAGE = 100; // documented maximum

// 500 requests/hour sustained → one every 7.2s; stay a little under.
export const jolpicaThrottle: Throttle = { intervalMs: 7_500, last: 0 };

export interface JDriver {
  driverId: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality: string;
  permanentNumber?: string;
}

export interface JConstructor {
  constructorId: string;
  name: string;
}

export interface JSessionTime {
  date: string;
  time?: string;
}

export interface JRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Qualifying?: JSessionTime;
  Sprint?: JSessionTime;
  SprintQualifying?: JSessionTime;
  SprintShootout?: JSessionTime;
  Results?: JResult[];
  QualifyingResults?: JQualifying[];
  SprintResults?: JResult[];
}

export interface JResult {
  number: string;
  position: string;
  positionText: string;
  Driver: JDriver;
  Constructor?: JConstructor;
  grid?: string;
  laps?: string;
  status?: string;
}

export interface JQualifying {
  number: string;
  position?: string;
  Driver: JDriver;
  Constructor: JConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

interface MRData {
  MRData: { total: string; RaceTable: { Races: JRace[] } };
}

type ResultField = "Results" | "QualifyingResults" | "SprintResults";

/**
 * Fetches every page of a season endpoint. Pages count rows, so one race can
 * straddle two pages; merge rows by round.
 */
async function fetchAllPages(path: string, field?: ResultField): Promise<JRace[]> {
  const byRound = new Map<string, JRace>();
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const data = await getJson<MRData>(`${BASE}/${path}?limit=${PAGE}&offset=${offset}`, jolpicaThrottle);
    total = Number(data.MRData.total);
    const races = data.MRData.RaceTable.Races;
    for (const race of races) {
      const existing = byRound.get(race.round);
      if (!existing) byRound.set(race.round, race);
      else if (field) {
        const merged = [...(existing[field] ?? []), ...(race[field] ?? [])];
        (existing as unknown as Record<ResultField, unknown[]>)[field] = merged;
      }
    }
    offset += PAGE;
    if (races.length === 0) break;
  }
  return [...byRound.values()].sort((a, b) => Number(a.round) - Number(b.round));
}

export interface JolpicaSeason {
  season: number;
  fetchedAt: string;
  schedule: JRace[];
  results: JRace[];
  qualifying: JRace[];
  sprint: JRace[];
}

export async function fetchSeason(season: number): Promise<JolpicaSeason> {
  const schedule = await fetchAllPages(`${season}/races/`);
  const results = await fetchAllPages(`${season}/results/`, "Results");
  // No qualifying data exists before 1994; sprints start in 2021.
  const qualifying = season >= 1994 ? await fetchAllPages(`${season}/qualifying/`, "QualifyingResults") : [];
  const sprint = season >= 2021 ? await fetchAllPages(`${season}/sprint/`, "SprintResults") : [];
  return { season, fetchedAt: new Date().toISOString(), schedule, results, qualifying, sprint };
}
