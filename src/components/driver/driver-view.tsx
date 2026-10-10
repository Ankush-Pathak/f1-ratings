"use client";

import { useSyncExternalStore } from "react";
import { DriverAvatar } from "@/components/driver-avatar";
import { RatingSystemSwitch } from "@/components/rating-system-switch";
import { Trend } from "@/components/trend";
import { careerSpan, eventLabel, fullName, RATING_LABEL, rating, teamColour } from "@/lib/format";
import { RATING_KEYS } from "@/lib/model";
import { type DriverSummary, type RatingSystem, systemView } from "@/lib/site-data";
import { DriverHistory } from "./driver-history";

// The chosen system lives in ?system= so links and reloads keep it. The page is static, so the
// URL is read in the browser; the server render (and first paint) uses the default.
const URL_EVENT = "rating-system-change";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}

function systemFromUrl(): RatingSystem {
  return new URLSearchParams(window.location.search).get("system") === "recentred" ? "recentred" : "default";
}

function setSystemInUrl(next: RatingSystem) {
  const url = new URL(window.location.href);
  if (next === "default") url.searchParams.delete("system");
  else url.searchParams.set("system", next);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(URL_EVENT));
}

/** Driver header + history, both following the Default / Re-centred switch (kept in ?system=). */
export function DriverView({
  driver: d,
  onGrid,
  teammates,
  updatedAt,
}: {
  driver: DriverSummary;
  onGrid: boolean;
  teammates: Record<string, string>;
  updatedAt: string;
}) {
  const system = useSyncExternalStore(subscribe, systemFromUrl, () => "default" as RatingSystem);

  const v = systemView(d, system);
  const available = RATING_KEYS.filter((k) => v.ratings[k].matches > 0);

  return (
    <>
      <header className="relative overflow-hidden rounded-xl border bg-card p-6">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: teamColour(d) }} aria-hidden />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4 sm:items-center">
            <DriverAvatar driver={d} size={72} className="mt-1 sm:mt-0" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{fullName(d)}</h1>
              <p className="text-muted-foreground">
                {d.nationality} · {careerSpan(d)} {onGrid && <span className="text-foreground">· {d.teamName}</span>}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Teams: {d.teams.join(", ")}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
            {available.map((k) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{RATING_LABEL[k]}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{rating(v.ratings[k].current)}</span>
                  {onGrid && <Trend value={v.ratings[k].trend} className="text-xs" />}
                </dd>
                <dd className="text-xs text-muted-foreground tabular-nums">peak {rating(v.ratings[k].peak)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {v.eventsAtNumberOne > 0 && <>Top-rated driver on the grid for {v.eventsAtNumberOne} weekends · </>}
          Overall peak {rating(v.ratings.overall.peak)}
          {v.ratings.overall.peakEvent && <> at the {eventLabel(v.ratings.overall.peakEvent)}</>}
        </p>
      </header>

      <DriverHistory
        driverId={d.id}
        system={system}
        teammates={teammates}
        available={available}
        updatedAt={updatedAt}
        scaleControl={<RatingSystemSwitch value={system} onChange={setSystemInUrl} />}
      />
    </>
  );
}
