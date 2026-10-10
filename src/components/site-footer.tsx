import { loadSummary } from "@/lib/data";
import { eventLabel } from "@/lib/format";

export function SiteFooter() {
  const { generatedAt, lastEvent } = loadSummary();
  const updated = new Date(generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          Inspired by{" "}
          <a className="underline underline-offset-4 hover:text-foreground" href="https://www.youtube.com/@MrVsGarage">
            Mr V&apos;s Garage
          </a>
          . Data from Jolpica-F1 and OpenF1. Unofficial fan site, not affiliated with Formula 1.{" "}
          <a className="underline underline-offset-4 hover:text-foreground" href="https://github.com/Ankush-Pathak/f1-ratings">
            Source on GitHub
          </a>
          .
        </p>
        <p>
          Updated {updated}
          {lastEvent ? ` · through ${eventLabel(lastEvent)}` : ""}
        </p>
      </div>
    </footer>
  );
}
