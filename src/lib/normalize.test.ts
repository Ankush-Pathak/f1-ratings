import { describe, expect, it } from "vitest";
import { isFinished, normalize, parseLapTime } from "./normalize";
import type { JolpicaSeason, JRace } from "./sources/jolpica";
import type { OpenF1Season } from "./sources/openf1";

describe("isFinished", () => {
  it("accepts finished and lapped cars in every era's wording", () => {
    for (const s of ["Finished", "Lapped", "+1 Lap", "+3 Laps"]) expect(isFinished(s)).toBe(true);
    for (const s of ["Retired", "Engine", "Disqualified", "Did not start", undefined]) expect(isFinished(s)).toBe(false);
  });
});

describe("parseLapTime", () => {
  it("parses m:ss.sss and ss.sss", () => {
    expect(parseLapTime("1:27.689")).toBe(87689);
    expect(parseLapTime("59.1")).toBe(59100);
    expect(parseLapTime("")).toBeNull();
    expect(parseLapTime(undefined)).toBeNull();
  });
});

const driver = (id: string) => ({ driverId: id, givenName: id, familyName: id.toUpperCase(), nationality: "X" });
const ctor = (id: string) => ({ constructorId: id, name: id });

function season(year: number, races: Partial<JRace>[], extra: Partial<JolpicaSeason> = {}): JolpicaSeason {
  const schedule = races.map((r, i) => ({ season: String(year), round: String(i + 1), raceName: "GP", date: `${year}-05-0${i + 1}`, ...r })) as JRace[];
  return { season: year, fetchedAt: "", schedule, results: [], qualifying: [], sprint: [], ...extra };
}

describe("normalize", () => {
  it("orders a 2024-style sprint weekend by session time and maps OpenF1 car numbers", () => {
    const sched: Partial<JRace> = {
      date: "2024-05-05",
      time: "20:00:00Z",
      SprintQualifying: { date: "2024-05-03", time: "20:30:00Z" },
      Sprint: { date: "2024-05-04", time: "16:00:00Z" },
      Qualifying: { date: "2024-05-04", time: "20:00:00Z" },
    };
    const row = (id: string, pos: number, num: string) => ({
      number: num,
      position: String(pos),
      positionText: String(pos),
      Driver: driver(id),
      Constructor: ctor("t"),
      status: "Finished",
    });
    const js = season(2024, [sched], {
      results: [{ round: "1", Results: [row("a", 1, "1"), row("b", 2, "2")] } as JRace],
      sprint: [{ round: "1", SprintResults: [row("b", 1, "2"), row("a", 2, "1")] } as JRace],
      qualifying: [
        {
          round: "1",
          QualifyingResults: [
            { number: "1", position: "1", Driver: driver("a"), Constructor: ctor("t"), Q1: "1:30.000", Q2: "1:29.000", Q3: "1:28.000" },
            { number: "2", position: "2", Driver: driver("b"), Constructor: ctor("t"), Q1: "1:30.500", Q2: "1:29.500" },
          ],
        } as JRace,
      ],
    });
    const of1: OpenF1Season = {
      season: 2024,
      fetchedAt: "",
      latestRaceDrivers: [],
      sprintQualifying: [
        {
          session: { session_key: 1, meeting_key: 1, session_name: "Sprint Qualifying", session_type: "Qualifying", date_start: "2024-05-03T20:30:00+00:00", date_end: "" },
          results: [
            { driver_number: 2, position: 1, duration: [90, 89, 88] },
            { driver_number: 1, position: 2, duration: [90.1, 89.1, null] },
          ],
          drivers: [],
        },
      ],
    };
    const { events } = normalize([js], [of1]);
    expect(events).toHaveLength(1);
    expect(events[0].sessions.map((s) => s.kind)).toEqual(["SQ1", "SQ2", "SQ3", "SPRINT", "Q1", "Q2", "Q3", "RACE"]);
    const sq3 = events[0].sessions[2];
    expect(sq3.entries.find((e) => e.driverId === "a")?.timeMs).toBeNull();
    expect(sq3.entries.find((e) => e.driverId === "b")?.timeMs).toBe(88000);
    const q3 = events[0].sessions[6];
    expect(q3.entries.find((e) => e.driverId === "b")?.timeMs).toBeNull();
  });

  it("uses one qualifying session 1994–2005 and none before 1994", () => {
    const q = [{ round: "1", QualifyingResults: [{ number: "1", position: "1", Driver: driver("a"), Constructor: ctor("t") }] } as JRace];
    const res = [{ round: "1", Results: [{ number: "1", position: "1", positionText: "1", Driver: driver("a"), Constructor: ctor("t"), status: "Finished" }] } as JRace];
    const e1999 = normalize([season(1999, [{}], { qualifying: q, results: res })], []).events[0];
    expect(e1999.sessions.map((s) => s.kind)).toEqual(["Q", "RACE"]);
    const e1990 = normalize([season(1990, [{}], { qualifying: q, results: res })], []).events[0];
    expect(e1990.sessions.map((s) => s.kind)).toEqual(["RACE"]);
  });

  it("drops the Indianapolis 500", () => {
    const res = [{ round: "1", Results: [{ number: "1", position: "1", positionText: "1", Driver: driver("a"), Constructor: ctor("t"), status: "Finished" }] } as JRace];
    expect(normalize([season(1955, [{ raceName: "Indianapolis 500" }], { results: res })], []).events).toHaveLength(0);
  });
});
