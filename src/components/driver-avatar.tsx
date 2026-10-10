"use client";

/* eslint-disable @next/next/no-img-element -- static export; remote headshots are served as-is */
import { useState } from "react";
import { initials, teamColour } from "@/lib/format";
import type { DriverSummary } from "@/lib/site-data";
import { cn } from "@/lib/utils";

/** Photo where we have one; initials on a team-coloured ring if there's none or it fails to load. */
export type AvatarDriver = Pick<DriverSummary, "givenName" | "familyName" | "headshot" | "teamColour">;

export function DriverAvatar({ driver, size = 40, className }: { driver: AvatarDriver; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, borderColor: teamColour(driver) };
  if (driver.headshot && !failed) {
    return (
      <img
        src={driver.headshot}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full border-2 bg-muted object-cover object-top", className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-muted font-semibold text-muted-foreground", className)}
      style={{ ...style, fontSize: size * 0.36 }}
    >
      {initials(driver)}
    </span>
  );
}
