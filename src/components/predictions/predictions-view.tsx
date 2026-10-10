"use client";

import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type AvatarDriver, DriverAvatar } from "@/components/driver-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { basePath, SESSION_LABEL, updatedNote } from "@/lib/format";
import {
  HEADLINE_LABEL,
  type HeadlineSession,
  type NextPreview,
  type PredictionSeason,
  predictionWeekendsUrl,
  type WeekendDetail,
  type PredictionMatch,
  type PredictionPair,
  type PredictionSummary,
  predictionMatchesUrl,
} from "@/lib/site-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScale } from "@/components/scale-provider";

const pct = (p: number) => `${Math.round(p * 100)}%`;
const short = (event: string) => event.replace(/ Grand Prix$/, " GP");

/** Called it: Elo's favourite for the season head-to-head came out ahead. Close calls are toss-ups. */
function verdict(p: PredictionPair): "called" | "missed" | "tossup" {
  const expectedLead = p.expectedA - (p.matches - p.expectedA);
  const actualLead = p.winsA - p.winsB;
  if (Math.abs(expectedLead) < 2) return "tossup";
  if (actualLead === 0) return "missed";
  return Math.sign(expectedLead) === Math.sign(actualLead) ? "called" : "missed";
}

/** How far the actual head-to-head lead swung from Elo's expected lead (in matches). */
function swing(p: PredictionPair): number {
  const expectedLead = p.expectedA - (p.matches - p.expectedA);
  return Math.abs(p.winsA - p.winsB - expectedLead);
}

function Name({ id, people }: { id: string; people: Record<string, string> }) {
  return (
    <Link href={`/driver/${id}/`} className="hover:underline">
      {people[id] ?? id}
    </Link>
  );
}

/** Full name on wide screens, surname on phones. */
function PairName({ id, people }: { id: string; people: Record<string, string> }) {
  const full = people[id] ?? id;
  return (
    <span className="font-medium">
      <span className="hidden sm:inline">{full}</span>
      <span className="sm:hidden">{full.split(" ").at(-1)}</span>
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

const surname = (people: Record<string, string>, id: string) => (people[id] ?? id).split(" ").at(-1);

function NextRace({ next, people }: { next: NextPreview; people: Record<string, string> }) {
  const date = new Date(`${next.date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  // Highlights use the race: the biggest favourite and the closest battle.
  const race = (p: NextPreview["pairs"][number]) => p.odds.RACE ?? 0.5;
  const banker = [...next.pairs].sort((x, y) => Math.abs(race(y) - 0.5) - Math.abs(race(x) - 0.5))[0];
  const closest = [...next.pairs].sort((x, y) => Math.abs(race(x) - 0.5) - Math.abs(race(y) - 0.5))[0];
  const fav = (p: NextPreview["pairs"][number], pA: number) =>
    pA >= 0.5 ? { id: p.a, chance: pA } : { id: p.b, chance: 1 - pA };
  const optional = new Set(["SQ", "SPRINT"]);
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next up</p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {next.name} <span className="text-muted-foreground">· {date}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {next.sprint ? "Sprint weekend. " : ""}Odds for every teammate battle from current ratings, assuming the
          current line-ups.
        </p>
      </div>

      {banker && closest && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Banker"
            value={pct(fav(banker, race(banker)).chance)}
            hint={
              <>
                <Name id={fav(banker, race(banker)).id} people={people} /> to beat their teammate in the race
              </>
            }
          />
          <StatCard
            label="Closest battle"
            value={`${pct(race(closest))} – ${pct(1 - race(closest))}`}
            hint={
              <>
                <Name id={closest.a} people={people} /> vs <Name id={closest.b} people={people} /> in the race
              </>
            }
          />
        </div>
      )}

      <Button variant="outline" size="sm" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
        {showTable ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {showTable ? "Hide" : "Show"} all {next.pairs.length} teammate battles
      </Button>

      {showTable && (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teammates</TableHead>
                  {next.sessions.map((sn) => (
                    <TableHead key={sn} className={cn("text-right", optional.has(sn) && "hidden md:table-cell")}>
                      {HEADLINE_LABEL[sn]}
                    </TableHead>
                  ))}
                  <TableHead
                    className="hidden text-right sm:table-cell"
                    title="Chance the favourite beats their teammate in every session"
                  >
                    Sweep
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {next.pairs.map((p) => {
                  const sweep = p.sweepA >= p.sweepB ? { id: p.a, chance: p.sweepA } : { id: p.b, chance: p.sweepB };
                  return (
                    <TableRow key={`${p.teamId}-${p.a}-${p.b}`}>
                      <TableCell className="whitespace-normal">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-6 w-1 shrink-0 rounded-full"
                            style={{
                              background: p.teamColour ?? "var(--muted-foreground)",
                            }}
                            aria-hidden
                          />
                          <span>
                            <PairName id={p.a} people={people} />
                            <span className="text-muted-foreground"> vs </span>
                            <PairName id={p.b} people={people} />
                            <span className="block text-xs text-muted-foreground">{p.teamName}</span>
                          </span>
                        </span>
                      </TableCell>
                      {next.sessions.map((sn) => {
                        const f = fav(p, p.odds[sn] ?? 0.5);
                        return (
                          <TableCell key={sn} className={cn("text-right", optional.has(sn) && "hidden md:table-cell")}>
                            <span className="block font-medium">{surname(people, f.id)}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{pct(f.chance)}</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="hidden text-right sm:table-cell">
                        <span className="block font-medium">{surname(people, sweep.id)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{pct(sweep.chance)}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Each cell is Elo&apos;s pick and their chance. Sweep = chance the likelier driver beats their teammate in
            every session, treating sessions as independent. After the weekend, these calls are graded in the scorecard
            below.
          </p>
        </>
      )}
    </section>
  );
}

const HEADLINE_ORDER: HeadlineSession[] = ["SQ", "SPRINT", "Q", "RACE"];

/** Grid of weekend tiles; clicking one shows every pre-weekend call vs the result. */
function WeekendScorecard({ s, people }: { s: PredictionSeason; people: Record<string, string> }) {
  const [openRound, setOpenRound] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, WeekendDetail[]>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (openRound == null || details[s.season]) return;
    let cancelled = false;
    fetch(predictionWeekendsUrl(basePath, s.season))
      .then((r) => (r.ok ? (r.json() as Promise<WeekendDetail[]>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => !cancelled && setDetails((prev) => ({ ...prev, [s.season]: d })))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [openRound, s.season, details]);

  const detail = details[s.season]?.find((d) => d.round === openRound);
  const open = s.weekends.find((w) => w.round === openRound);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Weekend scorecard</h2>
      <p className="text-xs text-muted-foreground">
        Each weekend&apos;s preview, made from ratings before the weekend, graded on final qualifying order, sprint
        qualifying, sprint and race. Click a weekend to see every call.
      </p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {s.weekends.map((w) => {
          const r = w.correct / w.calls;
          const isOpen = openRound === w.round;
          return (
            <li key={w.round}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenRound(isOpen ? null : w.round)}
                className={cn(
                  "w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-foreground/30",
                  isOpen && "border-primary ring-1 ring-primary",
                )}
              >
                <p className="truncate text-xs text-muted-foreground">
                  R{w.round} · {short(w.name)}
                </p>
                <p className="mt-1 font-semibold tabular-nums">
                  {w.correct}/{w.calls}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", r >= 0.5 ? "bg-up" : "bg-down")}
                    style={{ width: `${r * 100}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {open && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
            <p className="font-medium">
              R{open.round} · {open.name}{" "}
              <span className="text-sm text-muted-foreground tabular-nums">
                {open.correct}/{open.calls} called
              </span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => setOpenRound(null)} aria-label="Close weekend">
              <X className="size-4" />
            </Button>
          </div>
          {failed ? (
            <p className="p-4 text-sm text-muted-foreground">Couldn&apos;t load this weekend.</p>
          ) : !detail ? (
            <Skeleton className="m-4 h-32" />
          ) : (
            <WeekendCalls detail={detail} people={people} />
          )}
        </div>
      )}
    </section>
  );
}

function WeekendCalls({ detail, people }: { detail: WeekendDetail; people: Record<string, string> }) {
  const sessions = HEADLINE_ORDER.filter((sn) => detail.calls.some((c) => c.session === sn));
  const pairs = [...new Map(detail.calls.map((c) => [`${c.teamId}|${c.a}|${c.b}`, c])).values()];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-2 text-left font-medium">Teammates</th>
            {sessions.map((sn) => (
              <th key={sn} className="px-3 py-2 text-left font-medium">
                {HEADLINE_LABEL[sn]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {pairs.map((p) => (
            <tr key={`${p.teamId}|${p.a}|${p.b}`}>
              <td className="px-4 py-2">
                <PairName id={p.a} people={people} />
                <span className="text-muted-foreground"> vs </span>
                <PairName id={p.b} people={people} />
              </td>
              {sessions.map((sn) => {
                const c = detail.calls.find(
                  (x) => x.session === sn && x.a === p.a && x.b === p.b && x.teamId === p.teamId,
                );
                if (!c)
                  return (
                    <td key={sn} className="px-3 py-2 text-muted-foreground">
                      —
                    </td>
                  );
                const pick = c.pA >= 0.5 ? c.a : c.b;
                const chance = Math.max(c.pA, 1 - c.pA);
                const right = c.winner != null && c.pA !== 0.5 && c.winner === pick;
                return (
                  <td key={sn} className="px-3 py-2 align-top">
                    <span className="block text-xs text-muted-foreground">
                      Pick {surname(people, pick)} {pct(chance)}
                    </span>
                    {c.winner == null ? (
                      <span className="text-muted-foreground">No result</span>
                    ) : (
                      <span
                        className={cn("inline-flex items-center gap-1 font-medium", right ? "text-up" : "text-down")}
                      >
                        {right ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                        {surname(people, c.winner)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VERDICT = {
  called: { label: "Called it", icon: Check, className: "bg-up/15 text-up" },
  missed: { label: "Upset", icon: X, className: "bg-down/15 text-down" },
  tossup: { label: "Toss-up", icon: null, className: "bg-muted text-muted-foreground" },
} as const;

// Both teammates share a team colour, so each card tells them apart with a fixed pair: left driver
// blue, right driver amber. Names, win counts and the bar below all use the same two colours.
const SIDE_COLOUR = { left: "var(--side-a)", right: "var(--side-b)" } as const;

function Side({
  id,
  wins,
  people,
  faces,
  align,
}: {
  id: string;
  wins: number;
  people: Record<string, string>;
  faces: Record<string, AvatarDriver>;
  align: "left" | "right";
}) {
  const colour = SIDE_COLOUR[align];
  const face = faces[id];
  return (
    <Link
      href={`/driver/${id}/`}
      className={cn("flex min-w-0 items-center gap-3", align === "right" && "flex-row-reverse text-right")}
    >
      {face && <DriverAvatar driver={face} size={44} />}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold hover:underline" style={{ color: colour }}>
          {surname(people, id)}
        </span>
        <span className="block text-3xl font-semibold tracking-tight tabular-nums" style={{ color: colour }}>
          {wins}
        </span>
      </span>
    </Link>
  );
}

/** One teammate battle: actual head-to-head vs Elo's expectation, with tags and every call on demand. */
function BattleCard({
  pair: p,
  people,
  faces,
  biggestUpset,
  open,
  onToggle,
  matches,
  failed,
}: {
  pair: PredictionPair;
  people: Record<string, string>;
  faces: Record<string, AvatarDriver>;
  biggestUpset: boolean;
  open: boolean;
  onToggle: () => void;
  matches: PredictionMatch[] | undefined;
  failed: boolean;
}) {
  const v = VERDICT[verdict(p)];
  const decided = p.winsA + p.winsB;
  const expA = Math.round(p.expectedA);
  const expB = p.matches - p.draws - expA;
  const actualShare = decided ? p.winsA / decided : 0.5;
  const expectedShare = expA + expB ? expA / (expA + expB) : 0.5;
  const colour = p.teamColour ?? "var(--muted-foreground)";
  const Icon = v.icon;

  return (
    <article
      className={cn("relative overflow-hidden rounded-xl border bg-card p-4", open && "md:col-span-2 lg:col-span-3")}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: colour }} aria-hidden />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto truncate text-xs font-medium text-muted-foreground">{p.teamName}</span>
        {biggestUpset && (
          <Badge
            className="h-5 bg-down/15 px-1.5 text-[10px] text-down"
            title="The teammate battle that most defied Elo this season"
          >
            Biggest upset
          </Badge>
        )}
        {p.newPairing && (
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] text-primary"
            title="Line-up change: either driver's previous teammate was someone else"
          >
            New pairing
          </Badge>
        )}
        <span
          className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium", v.className)}
        >
          {Icon && <Icon className="size-3" />}
          {v.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Side id={p.a} wins={p.winsA} people={people} faces={faces} align="left" />
        <span className="text-sm text-muted-foreground">vs</span>
        <Side id={p.b} wins={p.winsB} people={people} faces={faces} align="right" />
      </div>

      {/* Actual split of decided matches in each driver's colour, with a marker where Elo expected it to land. */}
      <div className="relative mt-3" aria-hidden>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
          {decided > 0 && (
            <>
              <div className="h-full" style={{ width: `${actualShare * 100}%`, background: SIDE_COLOUR.left }} />
              <div className="h-full flex-1" style={{ background: SIDE_COLOUR.right }} />
            </>
          )}
        </div>
        <div
          className="absolute -top-1 h-4 w-0.5 rounded bg-foreground"
          style={{ left: `calc(${expectedShare * 100}% - 1px)` }}
          title="Elo's expectation"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Elo expected{" "}
        <span className="font-medium tabular-nums">
          <span style={{ color: SIDE_COLOUR.left }}>{expA}</span>–
          <span style={{ color: SIDE_COLOUR.right }}>{expB}</span>
        </span>{" "}
        · {p.matches} matches
      </p>

      <Button variant="ghost" size="sm" className="mt-2 -ml-2 h-7 px-2 text-xs" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {open ? "Hide calls" : "Show every call"}
      </Button>
      {open && (
        <div className="mt-2 rounded-lg border bg-muted/30">
          <PairMatches pair={p} matches={matches} failed={failed} people={people} />
        </div>
      )}
    </article>
  );
}

function winnerOf(m: PredictionMatch) {
  return m.result === "W" ? { winner: m.a, loser: m.b, chance: m.pA } : { winner: m.b, loser: m.a, chance: 1 - m.pA };
}

export function PredictionsView({
  predictions,
  people,
  faces,
  updatedAt,
}: {
  predictions: PredictionSummary;
  people: Record<string, string>;
  faces: Record<string, AvatarDriver>;
  updatedAt: string;
}) {
  const seasons = predictions.seasons;
  const { system } = useScale();
  const [season, setSeason] = useState(seasons[0]?.season);
  const [open, setOpen] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<number, PredictionMatch[]>>({});
  const [failed, setFailed] = useState(false);
  const s = seasons.find((x) => x.season === season);

  // Match-by-match calls are fetched per season, the first time a pair is opened.
  useEffect(() => {
    if (open == null || season == null || matches[season]) return;
    let cancelled = false;
    fetch(predictionMatchesUrl(basePath, season))
      .then((r) => (r.ok ? (r.json() as Promise<PredictionMatch[]>) : Promise.reject(new Error(String(r.status)))))
      .then((m) => !cancelled && setMatches((prev) => ({ ...prev, [season]: m })))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, season, matches]);

  if (!s) return <p className="py-10 text-muted-foreground">No predictions yet.</p>;
  const weekendCalls = s.weekends.reduce((n, w) => n + w.calls, 0);
  const weekendCorrect = s.weekends.reduce((n, w) => n + w.correct, 0);
  const rate = (r: { called: number; favouriteWins: number }) => (r.called ? pct(r.favouriteWins / r.called) : "—");
  const accuracy = s.called ? s.favouriteWins / s.called : 0;
  const top = s.upsets[0] ? winnerOf(s.upsets[0]) : null;
  const pairsCalled = s.pairs.filter((p) => verdict(p) === "called").length;
  // The battle that most defied Elo: a flipped head-to-head with the biggest swing.
  const biggestUpset = s.pairs.filter((p) => verdict(p) === "missed").sort((x, y) => swing(y) - swing(x))[0];
  const pairsDecided = s.pairs.filter((p) => verdict(p) !== "tossup").length;

  return (
    <div className="space-y-10 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prediction corner</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Before every session, the ratings say how likely each driver is to beat their teammate. Here&apos;s the next
          race, and how past calls held up.
        </p>
      </div>

      {system === "recentred" && (
        <p className="rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground">
          Predictions always use the Default scale: it calls teammate battles slightly better (64.4% vs 63.6% since
          1984), and the two scales differ by under a point on most calls.
        </p>
      )}

      {predictions.next && <NextRace next={predictions.next} people={people} />}

      <div className="flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Track record</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Season</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm font-medium dark:bg-input/30"
            value={season}
            onChange={(e) => {
              setSeason(Number(e.target.value));
              setOpen(null);
            }}
          >
            {seasons.map((x) => (
              <option key={x.season} value={x.season}>
                {x.season}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Teammate battles</h2>
        <p className="text-xs text-muted-foreground">
          {updatedNote(updatedAt)} Expected = Elo&apos;s predicted head-to-head from each match&apos;s pre-session
          ratings (default scale).
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {s.pairs.map((p) => {
            const key = `${p.teamId}|${p.a}|${p.b}`;
            return (
              <BattleCard
                key={key}
                pair={p}
                people={people}
                faces={faces}
                biggestUpset={p === biggestUpset}
                open={open === key}
                onToggle={() => setOpen(open === key ? null : key)}
                matches={matches[s.season]}
                failed={failed}
              />
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Elo called it"
          value={pct(accuracy)}
          hint={
            <>
              The favourite beat their teammate in {s.favouriteWins} of {s.called} matches. New pairings{" "}
              {rate(s.newPairings)} · established {rate(s.established)}.
            </>
          }
        />
        <StatCard
          label="Weekend previews"
          value={weekendCalls ? pct(weekendCorrect / weekendCalls) : "—"}
          hint={`Pre-weekend calls right in ${weekendCorrect} of ${weekendCalls} qualifying, sprint and race battles.`}
        />
        <StatCard
          label="Teammate battles called"
          value={`${pairsCalled}/${pairsDecided}`}
          hint="Seasons where Elo's favourite also won the head-to-head. Toss-ups left out."
        />
        <StatCard
          label="Biggest upset"
          value={top ? pct(top.chance) : "—"}
          hint={
            top && s.upsets[0] ? (
              <>
                <Name id={top.winner} people={people} /> beat <Name id={top.loser} people={people} />,{" "}
                {short(s.upsets[0].event)} {SESSION_LABEL[s.upsets[0].session]}
              </>
            ) : undefined
          }
        />
      </div>

      {s.weekends.length > 0 && <WeekendScorecard key={s.season} s={s} people={people} />}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Biggest upsets of {s.season}</h2>
        <ol className="divide-y rounded-xl border bg-card">
          {s.upsets.map((m, i) => {
            const u = winnerOf(m);
            return (
              <li
                key={`${m.round}-${m.session}-${m.a}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="font-medium">
                  <Name id={u.winner} people={people} /> beat <Name id={u.loser} people={people} />
                </span>
                <span className="text-muted-foreground">
                  {short(m.event)} · {SESSION_LABEL[m.session]}
                </span>
                <span className="ml-auto font-semibold text-down tabular-nums">Elo gave them {pct(u.chance)}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function PairMatches({
  pair,
  matches,
  failed,
  people,
}: {
  pair: PredictionPair;
  matches: PredictionMatch[] | undefined;
  failed: boolean;
  people: Record<string, string>;
}) {
  if (failed) return <p className="p-4 text-sm text-muted-foreground">Couldn&apos;t load the match list.</p>;
  if (!matches) return <Skeleton className="m-4 h-24" />;
  const rows = matches.filter((m) => m.a === pair.a && m.b === pair.b).reverse();
  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Event</th>
            <th className="px-2 py-2 text-left font-medium">Elo&apos;s pick</th>
            <th className="px-2 py-2 text-left font-medium">Won</th>
            <th className="px-4 py-2 text-right font-medium">Call</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((m, i) => {
            const fav = m.pA >= 0.5 ? m.a : m.b;
            const favChance = Math.max(m.pA, 1 - m.pA);
            const won = m.result === "D" ? null : m.result === "W" ? m.a : m.b;
            const right = won != null && m.pA !== 0.5 && won === fav;
            return (
              <tr key={`${m.round}-${m.session}-${i}`}>
                <td className="px-4 py-2">
                  {short(m.event)}
                  <span className="block text-xs text-muted-foreground">
                    {m.date} · {SESSION_LABEL[m.session]}
                  </span>
                </td>
                <td className="px-2 py-2">
                  {people[fav]?.split(" ").at(-1)}{" "}
                  <span className="text-muted-foreground tabular-nums">{pct(favChance)}</span>
                </td>
                <td className="px-2 py-2">{won ? people[won]?.split(" ").at(-1) : "Draw"}</td>
                <td className="px-4 py-2 text-right">
                  {won == null || m.pA === 0.5 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : right ? (
                    <Check className="ml-auto size-4 text-up" aria-label="Called it" />
                  ) : (
                    <X className="ml-auto size-4 text-down" aria-label="Missed" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
