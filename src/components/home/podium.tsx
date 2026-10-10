import Link from "next/link";
import { DriverAvatar } from "@/components/driver-avatar";
import { Trend } from "@/components/trend";
import { careerSpan, driverHref, eventLabel, fullName, RATING_LABEL, rating, teamColour } from "@/lib/format";
import type { RatingKey } from "@/lib/model";
import { type DriverSummary, type RatingSystem, type SystemView, systemView } from "@/lib/site-data";
import { cn } from "@/lib/utils";

export type Section = "allTime" | "current";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Peak in a category, or a dash when the driver has no matches in it (e.g. qualifying before 1994). */
function best(v: SystemView, key: "qualifying" | "race") {
  const r = v.ratings[key];
  return r.matches > 0 ? rating(r.peak) : "—";
}

function PodiumCard({
  driver,
  place,
  section,
  system,
  ratingKey,
}: {
  driver: DriverSummary;
  place: number;
  section: Section;
  system: RatingSystem;
  ratingKey: RatingKey;
}) {
  const v = systemView(driver, system);
  const o = v.ratings[ratingKey];
  const overall = ratingKey === "overall";
  const which = overall ? "" : ` · ${RATING_LABEL[ratingKey]}`;
  const winner = place === 1;
  return (
    <Link
      href={driverHref(driver.id, system)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 transition-shadow hover:shadow-md",
        winner ? "md:order-2 md:-mt-4 md:pb-8" : place === 2 ? "md:order-1" : "md:order-3",
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: teamColour(driver) }} aria-hidden />
      <div className="flex items-start justify-between">
        <span className={cn("text-sm font-semibold tabular-nums", winner ? "text-primary" : "text-muted-foreground")}>
          #{place}
        </span>
        {section === "current" && <Trend value={o.trend} className="text-sm" />}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <DriverAvatar driver={driver} size={winner ? 64 : 52} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight group-hover:underline">{fullName(driver)}</p>
          <p className="truncate text-sm text-muted-foreground">
            {section === "current" ? driver.teamName : careerSpan(driver)}
          </p>
        </div>
      </div>
      {/* The number the section ranks by is big and highlighted; the other sits beside it. */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className={cn("font-semibold tracking-tight text-highlight tabular-nums", winner ? "text-6xl" : "text-5xl")}>
            {rating(section === "allTime" ? o.peak : o.current)}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {section === "allTime" ? "Peak rating" : "Rating now"}
            {which}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{rating(section === "allTime" ? o.current : o.peak)}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{section === "allTime" ? "Now" : "Peak"}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 border-t pt-4">
        {!overall ? (
          // Category podiums: that category's own record.
          <>
            {o.peakEvent && <Stat label="Peaked at" value={eventLabel(o.peakEvent)} />}
            <Stat label="Head-to-head" value={`${o.wins}–${o.losses}`} />
            <Stat label="Matches" value={o.matches} />
          </>
        ) : section === "allTime" ? (
          <>
            {o.peakEvent && <Stat label="Peaked at" value={eventLabel(o.peakEvent)} />}
            <Stat label="Weekends at #1" value={v.eventsAtNumberOne} />
            <Stat label="Best quali / race" value={`${best(v, "qualifying")} / ${best(v, "race")}`} />
            <Stat label="Head-to-head" value={`${o.wins}–${o.losses}`} />
          </>
        ) : (
          <>
            <Stat label="vs teammate this season" value={`${driver.seasonRecord.wins}–${driver.seasonRecord.losses}`} />
            <Stat label="Best quali / race" value={`${best(v, "qualifying")} / ${best(v, "race")}`} />
            {o.peakEvent && <Stat label="Peaked at" value={eventLabel(o.peakEvent)} />}
          </>
        )}
      </dl>
    </Link>
  );
}

export function Podium({
  drivers,
  section,
  system,
  ratingKey,
}: {
  drivers: DriverSummary[];
  section: Section;
  system: RatingSystem;
  ratingKey: RatingKey;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3 md:items-end">
      {drivers.slice(0, 3).map((d, i) => (
        <PodiumCard key={d.id} driver={d} place={i + 1} section={section} system={system} ratingKey={ratingKey} />
      ))}
    </div>
  );
}
