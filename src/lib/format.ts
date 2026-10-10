import type { RatingKey, SessionKind } from "./model";
import type { DriverSummary, EventRef } from "./site-data";

export const RATING_LABEL: Record<RatingKey, string> = {
  overall: "Overall",
  qualifying: "Qualifying",
  race: "Race",
  sprint: "Sprint",
  sprintQualifying: "Sprint Quali",
};

export const SESSION_LABEL: Record<SessionKind, string> = {
  Q: "Qualifying",
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  RACE: "Grand Prix",
  SPRINT: "Sprint",
  SQ1: "SQ1",
  SQ2: "SQ2",
  SQ3: "SQ3",
};

export const fullName = (d: Pick<DriverSummary, "givenName" | "familyName">) => `${d.givenName} ${d.familyName}`;

export const initials = (d: Pick<DriverSummary, "givenName" | "familyName">) =>
  `${d.givenName[0] ?? ""}${d.familyName[0] ?? ""}`.toUpperCase();

export const teamColour = (d: Pick<DriverSummary, "teamColour">) => d.teamColour ?? "var(--muted-foreground)";

export const rating = (n: number) => Math.round(n).toString();

export const eventLabel = (e: EventRef) => `${e.season} ${e.name.replace(/ Grand Prix$/, " GP")}`;

export const careerSpan = (d: DriverSummary) =>
  d.firstSeason === d.lastSeason ? `${d.firstSeason}` : `${d.firstSeason}–${d.lastSeason}`;

/** "Updated at 10 Oct 2026, 09:12 UTC. Updated daily." Fixed to UTC so server and browser render the same text. */
export const updatedNote = (iso: string) =>
  `Updated at ${new Date(iso).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} UTC. Updated daily.`;

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Driver page link. The scale is a site-wide preference, so it isn't part of the URL. */
export const driverHref = (id: string) => `/driver/${id}/`;
