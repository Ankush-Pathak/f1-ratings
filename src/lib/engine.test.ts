import { describe, expect, it } from "vitest";
import { eloDelta, expectedScore } from "./elo";
import { compareEntries, computeRatings, DEFAULT_CONFIG, RECENTRED_CONFIG, teamsInSession } from "./engine";
import type { Entry, RaceEvent, Session } from "./model";


const race = (entries: Partial<Entry>[]): Session => ({
  kind: "RACE",
  entries: entries.map((e, i) => ({ driverId: `d${i}`, teamId: "t", position: i + 1, finished: true, ...e })),
});

const ev = (round: number, sessions: Session[], season = 2024, format?: Partial<RaceEvent["format"]>): RaceEvent => ({
  season,
  round,
  name: `GP ${round}`,
  date: `${season}-01-${String(round).padStart(2, "0")}`,
  sessions,
  format: { qualifying: true, sprint: false, sprintQualifying: false, ...format },
});

describe("elo", () => {
  it("expects even odds for equal ratings and ~10:1 at +400", () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 5);
  });
  it("moves K/2 for a win between equals", () => {
    expect(eloDelta(1000, 1000, 1, 32)).toBe(16);
    expect(eloDelta(1000, 1000, 0, 32)).toBe(-16);
  });
});

describe("compareEntries", () => {
  const e = (p: Partial<Entry>): Entry => ({ driverId: "x", teamId: "t", position: 1, ...p });
  it("skips a race match if either driver did not finish", () => {
    expect(compareEntries("RACE", e({ position: 1, finished: true }), e({ position: 2, finished: false }))).toBeNull();
    expect(compareEntries("RACE", e({ position: 3, finished: true }), e({ position: 2, finished: true }))).toBe(0);
  });
  it("compares knockout segments by time, only when both set one", () => {
    expect(compareEntries("Q2", e({ timeMs: 90000 }), e({ timeMs: 90100 }))).toBe(1);
    expect(compareEntries("Q3", e({ timeMs: 90000 }), e({ timeMs: null }))).toBeNull();
  });
  it("breaks identical segment times by official position", () => {
    expect(compareEntries("Q1", e({ timeMs: 90000, position: 5 }), e({ timeMs: 90000, position: 4 }))).toBe(0);
  });
  it("uses position for single-session qualifying", () => {
    expect(compareEntries("Q", e({ position: 7 }), e({ position: 3 }))).toBe(0);
  });
});

describe("teamsInSession", () => {
  it("keeps a driver's best entry when listed twice", () => {
    const s = race([
      { driverId: "a", position: 2 },
      { driverId: "b", position: 3 },
      { driverId: "a", position: 5 },
    ]);
    const team = teamsInSession(s).get("t")!;
    expect(team.map((m) => [m.driverId, m.position])).toEqual([["a", 2], ["b", 3]]);
  });
});

describe("computeRatings", () => {
  it("gives the winner +16 and the loser -16 in a first race between equals", () => {
    const r = computeRatings([ev(1, [race([{ driverId: "a" }, { driverId: "b" }])])]);
    expect(r.drivers.a.ratings.overall.current).toBe(1016);
    expect(r.drivers.b.ratings.race.current).toBe(984);
    expect(r.drivers.a.logs.race[0]).toMatchObject({ teammateId: "b", result: "W", delta: 16 });
    expect(r.drivers.a.logs.race[0].expected).toBe(0.5);
    expect(r.drivers.b.logs.race[0].expected).toBe(0.5);
  });

  it("ignores drivers without a teammate", () => {
    const s = race([{ driverId: "a", teamId: "x" }, { driverId: "b", teamId: "y" }]);
    const r = computeRatings([ev(1, [s])]);
    expect(r.drivers.a.ratings.overall.matches).toBe(0);
    expect(r.drivers.a.ratings.overall.current).toBe(1000);
  });

  it("weights quali segments so a full quali counts like one race in Overall", () => {
    const seg = (kind: "Q1" | "Q2" | "Q3"): Session => ({
      kind,
      entries: [
        { driverId: "a", teamId: "t", position: 1, timeMs: 1000 },
        { driverId: "b", teamId: "t", position: 2, timeMs: 1001 },
      ],
    });
    const r = computeRatings([ev(1, [seg("Q1"), seg("Q2"), seg("Q3")])]);
    // Three wins at K = 32/3 each; slightly under 16 because expectation shifts between segments.
    expect(r.drivers.a.ratings.overall.current).toBeGreaterThan(1015);
    expect(r.drivers.a.ratings.overall.current).toBeLessThan(1016);
    expect(r.drivers.a.ratings.qualifying.current).toBeCloseTo(r.drivers.a.ratings.overall.current, 10);
  });

  it("splits the stake in a three-car team and stays zero-sum", () => {
    const s = race([{ driverId: "a" }, { driverId: "b" }, { driverId: "c" }]);
    const r = computeRatings([ev(1, [s])]);
    // a beats b and c at half stake each: 8 + 8.
    expect(r.drivers.a.ratings.overall.current).toBe(1016);
    expect(r.drivers.c.ratings.overall.current).toBe(984);
    const total = ["a", "b", "c"].reduce((sum, id) => sum + r.drivers[id].ratings.overall.current, 0);
    expect(total).toBeCloseTo(3000, 10);
  });

  it("keeps total rating constant across many events (zero-sum)", () => {
    const events = Array.from({ length: 30 }, (_, i) =>
      ev(i + 1, [
        race([
          { driverId: "a", position: (i % 3) + 1 },
          { driverId: "b", position: ((i + 1) % 3) + 1 },
          { driverId: "c", position: ((i + 2) % 3) + 1, teamId: "u" },
          { driverId: "d", position: 4, teamId: "u", finished: i % 4 !== 0 },
        ]),
      ]),
    );
    const r = computeRatings(events);
    const total = Object.values(r.drivers).reduce((s, d) => s + d.ratings.overall.current, 0);
    expect(total).toBeCloseTo(4000, 8);
  });

  it("starts newcomers at the previous event's grid average", () => {
    const r = computeRatings(
      [
        ev(1, [race([{ driverId: "a" }, { driverId: "b" }])]), // a 1016, b 984
        ev(2, [race([{ driverId: "a" }, { driverId: "c" }])]), // b gone; c starts at avg(a, b) = 1000
        ev(3, [race([{ driverId: "a" }, { driverId: "d" }])]), // d starts at avg(a, c)
      ],
      { ...DEFAULT_CONFIG, seedAtGridAverage: true },
    );
    const [c] = r.drivers.c.logs.overall;
    expect(c.rating - c.delta).toBeCloseTo(1000, 10);
    const a2 = r.drivers.a.logs.overall[1].rating;
    const avg = (a2 + r.drivers.c.ratings.overall.current) / 2;
    const [d] = r.drivers.d.logs.overall;
    expect(d.rating - d.delta).toBeCloseTo(avg, 10);
    expect(avg).toBeGreaterThan(1000);
  });

  it("re-centres each event's grid to average 1000 and leaves absent drivers alone", () => {
    const r = computeRatings([
      ev(1, [race([{ driverId: "a" }, { driverId: "b" }]), race([{ driverId: "x", teamId: "u" }, { driverId: "y", teamId: "u" }])]),
      // b and y leave below 1000; a and x stay above, so this grid is re-centred down.
      ev(2, [race([{ driverId: "a" }, { driverId: "c" }]), race([{ driverId: "x", teamId: "u" }, { driverId: "z", teamId: "u" }])]),
    ], RECENTRED_CONFIG);
    const grid = ["a", "c", "x", "z"].map((id) => r.drivers[id].ratings.overall.current);
    expect(grid.reduce((s, v) => s + v, 0) / grid.length).toBeCloseTo(1000, 10);
    expect(r.drivers.b.ratings.overall.current).toBe(984); // retired after event 1: untouched
    // Log ratings are on the shifted scale.
    expect(r.drivers.a.logs.overall.at(-1)!.rating).toBeCloseTo(r.drivers.a.ratings.overall.current, 10);
  });

  it("gives every weekend the same Overall stake whatever data its era has", () => {
    // 1988: race only, so it carries the whole weekend's stake (2x).
    const old = computeRatings([ev(1, [race([{ driverId: "a" }, { driverId: "b" }])], 1988, { qualifying: false })]);
    expect(old.drivers.a.ratings.overall.current).toBe(1032);
    expect(old.drivers.a.ratings.race.current).toBe(1016); // category ratings are unscaled
    // Sprint weekend with sprint qualifying: 3 units of sessions squeezed into 2.
    const spr = computeRatings([
      ev(1, [race([{ driverId: "a" }, { driverId: "b" }])], 2024, { sprint: true, sprintQualifying: true }),
    ]);
    expect(spr.drivers.a.ratings.overall.current).toBeCloseTo(1000 + 16 * (2 / 3), 10);
  });

  it("reports the trend over the last events and the current grid", () => {
    const events = [1, 2, 3, 4].map((n) => ev(n, [race([{ driverId: "a" }, { driverId: "b" }])]));
    events.push(ev(5, [race([{ driverId: "b" }, { driverId: "c" }])]));
    const r = computeRatings(events);
    expect(r.currentGrid.sort()).toEqual(["b", "c"]);
    const a = r.drivers.a;
    const lastTwo = a.logs.overall.slice(-2).reduce((s, l) => s + l.delta, 0);
    expect(a.ratings.overall.trend).toBeCloseTo(lastTwo, 10); // rounds 3–4 fall in the 3-event window
    expect(a.eventsAtNumberOne).toBe(4);
  });
});
