# F1 Ratings

Elo ratings for Formula 1 drivers, built only from teammate head-to-heads: finish ahead of your teammate and you win the match. Inspired by [Mr V's Garage](https://www.youtube.com/@MrVsGarage) ([video 1](https://www.youtube.com/watch?v=U16a8tdrbII), [video 2](https://www.youtube.com/watch?v=spgttSAXYSA)).

## How it fits together

1. `scripts/fetch-data.ts` downloads results into `data/raw/` (committed). Finished seasons are fetched once; the current season is refreshed each run.
   - [Jolpica-F1](https://github.com/jolpica/jolpica-f1): races, qualifying, sprints (1982 onward). Limit 500 requests/hour, so a full re-fetch takes about an hour.
   - [OpenF1](https://openf1.org): sprint qualifying (2023 onward), photos, team colours. Blocks all access during live sessions; the script keeps cached data and retries next run.
2. `scripts/build-ratings.ts` recomputes all ratings from scratch into `data/generated/` (not committed).
3. `next build` exports a static site to `out/`.
4. `.github/workflows/daily.yml` runs all of this daily at 09:00 UTC and deploys to GitHub Pages.

Rating rules live in `src/lib/engine.ts` (tunable `DEFAULT_CONFIG`); raw-to-event conversion in `src/lib/normalize.ts`.

## Commands

```bash
npm test                              # engine + normalization tests
npx tsx scripts/fetch-data.ts         # update raw data (--jolpica / --openf1 for one source)
npx tsx scripts/build-ratings.ts      # recompute ratings
npm run dev                           # local site (needs data/generated)
npx next build                        # static export to out/
```

Unofficial fan project, not associated with Formula 1. Data © its providers: Jolpica (non-commercial use), OpenF1 (CC BY-NC-SA 4.0).
