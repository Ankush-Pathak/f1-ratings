import type { Metadata } from "next";
import type { AvatarDriver } from "@/components/driver-avatar";
import { PredictionsView } from "@/components/predictions/predictions-view";
import { loadPredictions, loadSummary } from "@/lib/data";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Prediction corner · F1 Ratings" };

export default function PredictionsPage() {
  const summary = loadSummary();
  const predictions = loadPredictions();

  // Names and photos for every driver that appears, so the client needs no other data.
  const people: Record<string, string> = {};
  const faces: Record<string, AvatarDriver> = {};
  for (const s of predictions.seasons) {
    for (const p of s.pairs) {
      for (const id of [p.a, p.b]) {
        const d = summary.drivers[id];
        people[id] = d ? fullName(d) : id;
        if (d) faces[id] = { givenName: d.givenName, familyName: d.familyName, headshot: d.headshot };
      }
    }
  }

  return <PredictionsView predictions={predictions} people={people} faces={faces} updatedAt={summary.generatedAt} />;
}
