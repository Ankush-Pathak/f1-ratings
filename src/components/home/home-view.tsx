"use client";

import { useMemo, useState } from "react";
import { RatingSystemSwitch } from "@/components/rating-system-switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RATING_LABEL } from "@/lib/format";
import { RATING_KEYS, type RatingKey } from "@/lib/model";
import { type DriverSummary, type RatingSystem, type SiteSummary, systemView } from "@/lib/site-data";
import { Leaderboard } from "./leaderboard";
import { Podium, type Section } from "./podium";

/** All-time ranks by peak, Current Grid by current rating. Drivers never rated in a category are left out. */
function rankDrivers(drivers: DriverSummary[], key: RatingKey, section: Section, system: RatingSystem) {
  const r = (d: DriverSummary) => systemView(d, system).ratings[key];
  return drivers
    .filter((d) => r(d).matches > 0)
    .sort((a, b) => (section === "allTime" ? r(b).peak - r(a).peak : r(b).current - r(a).current));
}

export function HomeView({ summary }: { summary: SiteSummary }) {
  const [section, setSection] = useState<Section>("current");
  const [ratingKey, setRatingKey] = useState<RatingKey>("overall");
  // One scale for both views, so switching Current Grid ↔ All-time keeps the same numbers.
  const [system, setSystem] = useState<RatingSystem>("default");

  const grid = useMemo(() => new Set(summary.currentGrid), [summary]);
  const pool = useMemo(() => {
    const all = Object.values(summary.drivers);
    return section === "allTime" ? all : all.filter((d) => grid.has(d.id));
  }, [summary, section, grid]);

  const board = useMemo(() => rankDrivers(pool, ratingKey, section, system), [pool, ratingKey, section, system]);
  const season = summary.lastEvent?.season;

  return (
    <div className="space-y-10 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {section === "allTime" ? "Greatest of All Time" : "Best on the Current Grid"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Elo ratings from teammate head-to-heads, {section === "allTime" ? "1982 to today" : `${season} season`}.
          </p>
          <RatingSystemSwitch value={system} onChange={setSystem} className="mt-3" />
        </div>
        <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
          <TabsList>
            <TabsTrigger value="current">Current Grid</TabsTrigger>
            <TabsTrigger value="allTime">All-time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* The category drives both the podium and the leaderboard, so it sits above both. */}
      <div className="space-y-6">
        <Tabs value={ratingKey} onValueChange={(v) => setRatingKey(v as RatingKey)} className="max-w-full overflow-x-auto overflow-y-hidden">
          <TabsList>
            {RATING_KEYS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {RATING_LABEL[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Podium drivers={board} section={section} system={system} ratingKey={ratingKey} />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Leaderboard</h2>
        <Leaderboard
          drivers={board}
          ratingKey={ratingKey}
          section={section}
          system={system}
          active={grid}
          updatedAt={summary.generatedAt}
        />
      </section>
    </div>
  );
}
