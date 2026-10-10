"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Brush, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { basePath, eventLabel, RATING_LABEL, SESSION_LABEL, rating, updatedNote } from "@/lib/format";
import type { RatingKey, SessionKind } from "@/lib/model";
import { type LogEntry, logUrl, type RatingSystem } from "@/lib/site-data";
import { cn } from "@/lib/utils";

interface ChartPoint {
  t: number;
  season: number;
  round: number;
  label: string;
  rating: number;
  delta: number;
}

const chartConfig = { rating: { label: "Rating", color: "var(--chart-1)" } } satisfies ChartConfig;
const PAGE = 40;

function signed(n: number) {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toFixed(1)}`;
}

/** One chart point per event: the rating after that weekend's last update. */
function toPoints(logs: LogEntry[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const l of logs) {
    const last = points.at(-1);
    if (last && last.season === l.season && last.round === l.round) {
      last.rating = l.rating;
      last.delta += l.delta;
    } else {
      points.push({
        t: Date.parse(l.date),
        season: l.season,
        round: l.round,
        label: eventLabel({ ...l, name: l.event }),
        rating: l.rating,
        delta: l.delta,
      });
    }
  }
  return points;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="tabular-nums">
        {rating(p.rating)}{" "}
        <span className={cn("text-xs", p.delta > 0 ? "text-up" : p.delta < 0 ? "text-down" : "text-muted-foreground")}>
          {signed(p.delta)}
        </span>
      </p>
    </div>
  );
}

/** Tabs for each rating; a rating's log is fetched the first time its tab opens. */
export function DriverHistory({
  driverId,
  system,
  teammates,
  available,
  updatedAt,
  scaleControl,
}: {
  driverId: string;
  system: RatingSystem;
  teammates: Record<string, string>;
  available: RatingKey[];
  updatedAt: string;
  /** Rendered at the right end of the rating tabs row. */
  scaleControl?: React.ReactNode;
}) {
  const [key, setKey] = useState<RatingKey>(available[0] ?? "overall");
  // Logs per "<system>/<rating>", fetched the first time each is shown.
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const cacheKey = `${system}/${key}`;

  useEffect(() => {
    if (logs[cacheKey] || failed[cacheKey]) return;
    let cancelled = false;
    fetch(logUrl(basePath, driverId, system, key))
      .then((r) => (r.ok ? (r.json() as Promise<LogEntry[]>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((l) => !cancelled && setLogs((prev) => ({ ...prev, [cacheKey]: l })))
      .catch(() => !cancelled && setFailed((prev) => ({ ...prev, [cacheKey]: true })));
    return () => {
      cancelled = true;
    };
  }, [driverId, system, key, cacheKey, logs, failed]);

  const current = logs[cacheKey];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={key} onValueChange={(v) => setKey(v as RatingKey)} className="max-w-full overflow-x-auto overflow-y-hidden">
          <TabsList>
            {available.map((k) => (
              <TabsTrigger key={k} value={k}>
                {RATING_LABEL[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {scaleControl}
      </div>

      {failed[cacheKey] ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Couldn&apos;t load this history. Try reloading the page.
        </p>
      ) : current ? (
        <HistoryContent key={key} ratingKey={key} system={system} logs={current} teammates={teammates} updatedAt={updatedAt} />
      ) : (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}
    </section>
  );
}

const SESSION_ORDER: SessionKind[] = ["Q", "Q1", "Q2", "Q3", "SQ1", "SQ2", "SQ3", "SPRINT", "RACE"];

interface Filters {
  from: string;
  to: string;
  session: SessionKind | "";
  teammate: string;
  result: LogEntry["result"] | "";
  changeMin: string;
  changeMax: string;
  ratingMin: string;
  ratingMax: string;
}

const NO_FILTERS: Filters = {
  from: "",
  to: "",
  session: "",
  teammate: "",
  result: "",
  changeMin: "",
  changeMax: "",
  ratingMin: "",
  ratingMax: "",
};

const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

function matches(l: LogEntry, f: Filters): boolean {
  const cMin = num(f.changeMin);
  const cMax = num(f.changeMax);
  const rMin = num(f.ratingMin);
  const rMax = num(f.ratingMax);
  return (
    (!f.from || l.date >= f.from) &&
    (!f.to || l.date <= f.to) &&
    (!f.session || l.session === f.session) &&
    (!f.teammate || l.teammateId === f.teammate) &&
    (!f.result || l.result === f.result) &&
    (cMin == null || l.delta >= cMin) &&
    (cMax == null || l.delta <= cMax) &&
    (rMin == null || l.rating >= rMin) &&
    (rMax == null || l.rating <= rMax)
  );
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function RangeInputs({
  min,
  max,
  onMin,
  onMax,
  label,
  step,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  label: string;
  step: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input type="number" inputMode="decimal" step={step} placeholder="min" value={min} onChange={(e) => onMin(e.target.value)} aria-label={`${label} minimum`} />
      <span className="text-muted-foreground">–</span>
      <Input type="number" inputMode="decimal" step={step} placeholder="max" value={max} onChange={(e) => onMax(e.target.value)} aria-label={`${label} maximum`} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

function LogFilters({
  filters,
  set,
  sessions,
  teammateOptions,
  minDate,
  maxDate,
}: {
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  sessions: SessionKind[];
  teammateOptions: { id: string; name: string }[];
  minDate: string;
  maxDate: string;
}) {
  return (
    <div className="grid gap-5 rounded-xl border bg-card p-4 md:grid-cols-3">
      <Group title="When">
        <Field label="From">
          <Input type="date" min={minDate} max={maxDate} value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        </Field>
        <Field label="To">
          <Input type="date" min={minDate} max={maxDate} value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </Field>
      </Group>
      <Group title="Match">
        <Field label="Session">
          <select className={selectClass} value={filters.session} onChange={(e) => set({ session: e.target.value as Filters["session"] })}>
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {SESSION_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Teammate">
          <select className={selectClass} value={filters.teammate} onChange={(e) => set({ teammate: e.target.value })}>
            <option value="">All teammates</option>
            {teammateOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Result">
          <select className={selectClass} value={filters.result} onChange={(e) => set({ result: e.target.value as Filters["result"] })}>
            <option value="">Any result</option>
            <option value="W">Won</option>
            <option value="L">Lost</option>
            <option value="D">Draw</option>
          </select>
        </Field>
      </Group>
      <Group title="Numbers">
        <Field label="Change">
          <RangeInputs label="Change" step="0.5" min={filters.changeMin} max={filters.changeMax} onMin={(v) => set({ changeMin: v })} onMax={(v) => set({ changeMax: v })} />
        </Field>
        <Field label="Rating">
          <RangeInputs label="Rating" step="10" min={filters.ratingMin} max={filters.ratingMax} onMin={(v) => set({ ratingMin: v })} onMax={(v) => set({ ratingMax: v })} />
        </Field>
      </Group>
    </div>
  );
}

const RESULT_LABEL = { W: "Won", L: "Lost", D: "Draw" } as const;

/** One removable chip per active filter (ranges collapse into one chip). */
function activeChips(f: Filters, teammates: Record<string, string>): { label: string; clear: Partial<Filters> }[] {
  const range = (name: string, min: string, max: string) =>
    min && max ? `${name} ${min} to ${max}` : min ? `${name} ≥ ${min}` : `${name} ≤ ${max}`;
  const chips: { label: string; clear: Partial<Filters> }[] = [];
  if (f.from || f.to) chips.push({ label: f.from && f.to ? `${f.from} – ${f.to}` : f.from ? `From ${f.from}` : `Until ${f.to}`, clear: { from: "", to: "" } });
  if (f.session) chips.push({ label: SESSION_LABEL[f.session], clear: { session: "" } });
  if (f.teammate) chips.push({ label: `vs ${teammates[f.teammate] ?? f.teammate}`, clear: { teammate: "" } });
  if (f.result) chips.push({ label: RESULT_LABEL[f.result], clear: { result: "" } });
  if (f.changeMin || f.changeMax) chips.push({ label: range("Change", f.changeMin, f.changeMax), clear: { changeMin: "", changeMax: "" } });
  if (f.ratingMin || f.ratingMax) chips.push({ label: range("Rating", f.ratingMin, f.ratingMax), clear: { ratingMin: "", ratingMax: "" } });
  return chips;
}

function HistoryContent({
  ratingKey,
  system,
  logs,
  teammates,
  updatedAt,
}: {
  ratingKey: RatingKey;
  system: RatingSystem;
  updatedAt: string;
  logs: LogEntry[];
  teammates: Record<string, string>;
}) {
  const [shown, setShown] = useState(PAGE);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const data = useMemo(() => toPoints(logs), [logs]);
  const all = useMemo(() => [...logs].reverse(), [logs]);
  const entries = useMemo(() => all.filter((l) => matches(l, filters)), [all, filters]);
  const chips = activeChips(filters, teammates);
  const filtering = chips.length > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sessions = useMemo(() => SESSION_ORDER.filter((s) => logs.some((l) => l.session === s)), [logs]);
  const teammateOptions = useMemo(
    () =>
      [...new Set(logs.map((l) => l.teammateId))]
        .map((id) => ({ id, name: teammates[id] ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [logs, teammates],
  );
  const setFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShown(PAGE);
  };
  const years = data.length ? new Date(data.at(-1)!.t).getUTCFullYear() - new Date(data[0].t).getUTCFullYear() : 0;
  // Long careers: one tick per year (or every few years) at 1 January, so labels never repeat.
  const ticks =
    years >= 2
      ? Array.from({ length: years }, (_, i) => Date.UTC(new Date(data[0].t).getUTCFullYear() + i + 1, 0, 1)).filter(
          (_, i, all) => all.length <= 12 || i % Math.ceil(all.length / 12) === 0,
        )
      : undefined;

  return (
    <>
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{RATING_LABEL[ratingKey]} rating over time</h2>
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full sm:h-80">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(t: number) =>
                new Date(t).toLocaleDateString("en-GB", years >= 2 ? { year: "numeric" } : { month: "short", year: "2-digit" })
              }
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} width={44} />
            <ReferenceLine y={1000} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="4 4" ifOverflow="extendDomain" />
            <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<PointTooltip />} />
            <Line dataKey="rating" type="monotone" stroke="var(--color-rating)" strokeWidth={2} dot={false} isAnimationActive={false} />
            {data.length > 30 && (
              <Brush dataKey="t" height={24} stroke="var(--chart-1)" fill="var(--card)" tickFormatter={() => ""} travellerWidth={8} />
            )}
          </LineChart>
        </ChartContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Dashed line = {system === "recentred" ? "grid average" : "starting rating"} (1000).
          {data.length > 30 && " Drag the handles below the chart to zoom into a period."}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Rating log</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {filtering ? `${entries.length} of ${all.length}` : all.length} matches
            </span>
            <Button variant="outline" size="sm" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
              <SlidersHorizontal className="size-3.5" />
              Filters
              {filtering && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 tabular-nums">
                  {chips.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>
        {filtering && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pl-2.5 pr-1 text-xs">
                {c.label}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove filter: ${c.label}`}
                  onClick={() => setFilter(c.clear)}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setFilter(NO_FILTERS)}>
              Clear all
            </Button>
          </div>
        )}
        {filtersOpen && (
          <LogFilters
            filters={filters}
            set={setFilter}
            sessions={sessions}
            teammateOptions={teammateOptions}
            minDate={logs[0]?.date ?? ""}
            maxDate={logs.at(-1)?.date ?? ""}
          />
        )}
        <p className="text-xs text-muted-foreground">{updatedNote(updatedAt)}</p>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="hidden sm:table-cell">Teammate</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.slice(0, shown).map((l, i) => (
                <TableRow key={`${l.season}-${l.round}-${l.session}-${l.teammateId}-${i}`}>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">{l.date}</TableCell>
                  <TableCell className="max-w-48 whitespace-normal sm:max-w-none">
                    <span className="block">{l.event}</span>
                    <span className="block text-xs text-muted-foreground">
                      <span className="tabular-nums sm:hidden">{l.date} · </span>
                      {SESSION_LABEL[l.session]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {teammates[l.teammateId] ? (
                      <Link href={`/driver/${l.teammateId}/`} className="hover:underline">
                        {teammates[l.teammateId]}
                      </Link>
                    ) : (
                      l.teammateId
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium",
                        l.result === "W" ? "bg-up/15 text-up" : l.result === "L" ? "bg-down/15 text-down" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {l.result === "W" ? "Won" : l.result === "L" ? "Lost" : "Draw"}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", l.delta > 0 ? "text-up" : l.delta < 0 ? "text-down" : "")}>
                    {signed(l.delta)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{rating(l.rating)}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No matches fit these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {entries.length > shown && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
              Load more ({entries.length - shown} left)
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
