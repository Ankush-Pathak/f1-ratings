import Link from "next/link";
import { HeaderScale } from "./header-scale";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
          <span className="inline-block h-4 w-1.5 -skew-x-12 rounded-sm bg-primary" aria-hidden />
          F1 Ratings
        </Link>
        <HeaderScale className="ml-auto hidden md:flex" />
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          {/* On phones the logo is the way home. */}
          <Link href="/" className="hidden rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            Leaderboards
          </Link>
          <Link href="/predictions/" className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground sm:px-3">
            Predictions
          </Link>
          <Link href="/about/" className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground sm:px-3">
            About
          </Link>
          <ThemeToggle />
        </nav>
      </div>
      {/* Phones: the scale gets its own slim row. */}
      <div className="flex justify-end border-t px-4 py-1.5 md:hidden">
        <HeaderScale />
      </div>
    </header>
  );
}
