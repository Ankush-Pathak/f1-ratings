import { cn } from "@/lib/utils";

/** ▲ green / ▼ red with the point change; a grey dash when flat. Never colour alone. */
export function Trend({ value, className }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return (
      <span className={cn("text-muted-foreground tabular-nums", className)} aria-label="No change">
        —
      </span>
    );
  }
  const up = rounded > 0;
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-medium tabular-nums", up ? "text-up" : "text-down", className)}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(rounded)} over the last 3 race weekends`}
      title="Change over the last 3 race weekends"
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {Math.abs(rounded)}
    </span>
  );
}
