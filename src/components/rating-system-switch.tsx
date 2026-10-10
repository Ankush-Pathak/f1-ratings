"use client";

import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RatingSystem } from "@/lib/site-data";
import { cn } from "@/lib/utils";

const OPTIONS: { value: RatingSystem; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "recentred", label: "Re-centred" },
];

/** Compact "Scale: Default | Re-centred (?)" control. The (?) opens on hover, focus or tap. */
export function RatingSystemSwitch({
  value,
  onChange,
  className,
}: {
  value: RatingSystem;
  onChange: (v: RatingSystem) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground">Scale</span>
      <div role="radiogroup" aria-label="Rating scale" className="inline-flex rounded-md border p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[5px] px-2 py-0.5 text-xs font-medium transition-colors",
              value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={100}
          className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2"
          aria-label="What's the difference?"
        >
          <CircleHelp className="size-4" />
        </PopoverTrigger>
        <PopoverContent side="bottom" className="w-80 max-w-[calc(100vw-2rem)] space-y-2 text-sm leading-relaxed">
          <p>
            <strong>Default</strong>: a running total. Points won from teammates add up over a career, so long careers and
            the modern era (more sessions, fewer retirements) tend to score higher.
          </p>
          <p>
            <strong>Re-centred</strong>: after every race weekend, that weekend&apos;s grid is shifted so its average is
            1000. A rating means &ldquo;how far above the field of the day&rdquo;, which compares eras more fairly. Long
            careers slowly give back points won from drivers who later left.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
