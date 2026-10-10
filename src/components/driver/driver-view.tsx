"use client";

import { DriverAvatar } from "@/components/driver-avatar";
import { useScale } from "@/components/scale-provider";
import { Trend } from "@/components/trend";
import { careerSpan, eventLabel, fullName, RATING_LABEL, rating, teamColour } from "@/lib/format";
import { RATING_KEYS } from "@/lib/model";
import { type DriverRanks, type DriverSummary, systemView } from "@/lib/site-data";
import { DriverHistory } from "./driver-history";

/** Driver header + history, both following the site-wide scale. */
export function DriverView({
  driver: d,
  onGrid,
  teammates,
  ranks,
  updatedAt,
}: {
  driver: DriverSummary;
  onGrid: boolean;
  teammates: Record<string, string>;
  ranks: DriverRanks;
  updatedAt: string;
}) {
  const { system } = useScale();

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
                <dd className="mt-0.5 text-xs tabular-nums">
                  {ranks[system][k].grid != null && (
                    <span className="font-medium text-foreground" title="Rank on the current grid">
                      #{ranks[system][k].grid} grid ·{" "}
                    </span>
                  )}
                  <span className="text-muted-foreground" title="All-time rank, by peak rating">
                    #{ranks[system][k].allTime} all-time
                  </span>
                </dd>
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
      />
    </>
  );
}
