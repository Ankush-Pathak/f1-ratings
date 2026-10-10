import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export interface Teaser {
  race: string;
  date: string;
  banker: { name: string; chance: number } | null;
  closest: { a: string; b: string; pA: number } | null;
  /** Elo's pre-weekend hit rate this season. */
  record: { season: number; correct: number; calls: number } | null;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Slim banner advertising the Prediction corner with a taste of the next race. */
export function PredictionTeaser({ t }: { t: Teaser }) {
  const date = new Date(`${t.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <Link
      href="/predictions/"
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-0.5 text-sm">
          <p className="font-semibold">
            Next up: {t.race} <span className="font-normal text-muted-foreground">· {date}</span>
          </p>
          <p className="text-muted-foreground">
            {t.banker && (
              <>
                Banker: <span className="text-foreground">{t.banker.name}</span> {pct(t.banker.chance)} to beat their
                teammate.{" "}
              </>
            )}
            {t.closest && (
              <>
                Closest: <span className="text-foreground">{t.closest.a}</span> vs{" "}
                <span className="text-foreground">{t.closest.b}</span> {pct(t.closest.pA)}–{pct(1 - t.closest.pA)}.{" "}
              </>
            )}
            {t.record && t.record.calls > 0 && (
              <>
                Elo has called {pct(t.record.correct / t.record.calls)} of {t.record.season}&apos;s weekend battles.
              </>
            )}
          </p>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
        Prediction corner <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
