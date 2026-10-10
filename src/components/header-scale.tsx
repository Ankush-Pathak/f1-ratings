"use client";

import { RatingSystemSwitch } from "./rating-system-switch";
import { useScale } from "./scale-provider";

/** The site-wide scale switch, connected to the stored preference. */
export function HeaderScale({ className }: { className?: string }) {
  const { system, setSystem } = useScale();
  return <RatingSystemSwitch value={system} onChange={setSystem} className={className} />;
}
