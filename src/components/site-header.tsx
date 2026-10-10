import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-4 w-1.5 -skew-x-12 rounded-sm bg-primary" aria-hidden />
          F1 Ratings
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Leaderboards
          </Link>
          <Link href="/about/" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            About
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
