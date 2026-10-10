// Polite JSON fetching: fixed spacing between requests and backoff on throttling.

export const USER_AGENT = "f1-ratings/0.1 (+https://github.com/Ankush-Pathak/f1-ratings)";

export class LiveSessionLockout extends Error {}

export interface Throttle {
  /** Minimum gap between requests, ms. */
  intervalMs: number;
  last: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson<T>(url: string, throttle: Throttle, retries = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const wait = throttle.last + throttle.intervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    throttle.last = Date.now();

    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;

    const body = await res.text();
    if (res.status === 401 && body.includes("Live F1 session in progress")) {
      throw new LiveSessionLockout(`OpenF1 is locked during a live session (${url})`);
    }
    // Neither API documents Retry-After; back off 1, 2, 4, 8, 16 minutes.
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const backoff = 60_000 * 2 ** attempt;
      console.warn(`HTTP ${res.status} for ${url}; retrying in ${backoff / 1000}s`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
}
