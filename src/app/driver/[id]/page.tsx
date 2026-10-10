import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DriverView } from "@/components/driver/driver-view";
import { loadDriverLog, loadSummary } from "@/lib/data";
import { fullName } from "@/lib/format";
import { driverRanks } from "@/lib/site-data";
import { RATING_KEYS } from "@/lib/model";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(loadSummary().drivers).map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = loadSummary().drivers[id];
  return { title: `${fullName(d)} · F1 Ratings` };
}

export default async function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = loadSummary();
  const d = summary.drivers[id];
  // Logs are fetched in the browser per tab; only teammate names are embedded in the page.
  const teammates: Record<string, string> = {};
  for (const key of RATING_KEYS) {
    for (const l of loadDriverLog(id, key)) {
      const t = summary.drivers[l.teammateId];
      if (t) teammates[l.teammateId] = fullName(t);
    }
  }

  const onGrid = summary.currentGrid.includes(id);

  return (
    <div className="space-y-8 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Leaderboards
      </Link>

      <DriverView
        driver={d}
        onGrid={onGrid}
        teammates={teammates}
        ranks={driverRanks(summary, id)}
        updatedAt={summary.generatedAt}
      />
    </div>
  );
}
