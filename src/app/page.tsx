import { HomeView } from "@/components/home/home-view";
import type { Teaser } from "@/components/home/prediction-teaser";
import { loadPredictions, loadSummary } from "@/lib/data";
import { fullName } from "@/lib/format";
import type { SiteSummary } from "@/lib/site-data";

/** Next-race highlights for the front-page banner (race odds: biggest favourite, closest battle). */
function buildTeaser(summary: SiteSummary): Teaser | null {
  const { next, seasons } = loadPredictions();
  if (!next) return null;
  const name = (id: string) => (summary.drivers[id] ? fullName(summary.drivers[id]) : id);
  const race = (pA: number | undefined) => pA ?? 0.5;
  const byEdge = [...next.pairs].sort((x, y) => Math.abs(race(y.odds.RACE) - 0.5) - Math.abs(race(x.odds.RACE) - 0.5));
  const banker = byEdge[0];
  const closest = byEdge.at(-1);
  const current = seasons.find((s) => s.season === next.season);
  const bankerP = banker ? race(banker.odds.RACE) : 0.5;
  return {
    race: next.name,
    date: next.date,
    banker: banker ? { name: name(bankerP >= 0.5 ? banker.a : banker.b), chance: Math.max(bankerP, 1 - bankerP) } : null,
    closest: closest ? { a: name(closest.a), b: name(closest.b), pA: race(closest.odds.RACE) } : null,
    record: current
      ? {
          season: current.season,
          correct: current.weekends.reduce((n, w) => n + w.correct, 0),
          calls: current.weekends.reduce((n, w) => n + w.calls, 0),
        }
      : null,
  };
}

export default function Home() {
  const summary = loadSummary();
  return <HomeView summary={summary} teaser={buildTeaser(summary)} />;
}
