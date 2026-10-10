"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DriverAvatar } from "@/components/driver-avatar";
import { Trend } from "@/components/trend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { careerSpan, driverHref, fullName, rating, teamColour, updatedNote } from "@/lib/format";
import type { RatingKey } from "@/lib/model";
import { type DriverSummary, type RatingSystem, systemView } from "@/lib/site-data";
import type { Section } from "./podium";

const PAGE = 50;

export function Leaderboard({
  drivers,
  ratingKey,
  section,
  system,
  active,
  updatedAt,
}: {
  drivers: DriverSummary[];
  ratingKey: RatingKey;
  section: Section;
  system: RatingSystem;
  /** Drivers on the current grid; only they get a trend. */
  active: Set<string>;
  updatedAt: string;
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  // Rank is fixed by the full list, so a search keeps each driver's real position.
  const ranked = useMemo(() => drivers.map((d, i) => ({ d, rank: i + 1 })), [drivers]);
  const q = query.trim().toLowerCase();
  const filtered = q ? ranked.filter(({ d }) => fullName(d).toLowerCase().includes(q)) : ranked;
  const visible = filtered.slice(0, shown);

  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder="Search drivers"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
        className="max-w-xs"
        aria-label="Search drivers"
      />
      <p className="text-xs text-muted-foreground">{updatedNote(updatedAt)}</p>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-right">#</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead className="text-right">{section === "allTime" ? "Peak" : "Rating"}</TableHead>
              <TableHead className="text-right">Trend</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{section === "allTime" ? "Current" : "Peak"}</TableHead>
              <TableHead className="hidden text-right md:table-cell">W–L</TableHead>
              <TableHead className="hidden text-right md:table-cell">Matches</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(({ d, rank }) => {
              const r = systemView(d, system).ratings[ratingKey];
              return (
                <TableRow key={d.id} className="group">
                  <TableCell className="text-right text-muted-foreground tabular-nums">{rank}</TableCell>
                  <TableCell>
                    <Link href={driverHref(d.id, system)} className="flex items-center gap-3">
                      <span className="h-8 w-1 rounded-full" style={{ background: teamColour(d) }} aria-hidden />
                      <DriverAvatar driver={d} size={32} className="hidden sm:inline-flex" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline">{fullName(d)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {section === "current" ? d.teamName : careerSpan(d)}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-base font-semibold tabular-nums">
                    {rating(section === "allTime" ? r.peak : r.current)}
                  </TableCell>
                  <TableCell className="text-right">
                    {active.has(d.id) && <Trend value={r.trend} />}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {rating(section === "allTime" ? r.current : r.peak)}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {r.wins}–{r.losses}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">{r.matches}</TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No drivers match “{query}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filtered.length > shown && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({filtered.length - shown} left)
          </Button>
        </div>
      )}
    </div>
  );
}
