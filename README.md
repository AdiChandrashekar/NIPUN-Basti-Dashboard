# NIPUN Basti — Competency Dashboard

A React dashboard tracking school-wise NIPUN/FLN competency assessment results for
Basti district, month over month. Built to keep working as new months of data
arrive — no code changes needed for that part.

**Live demo**: enable GitHub Pages for this repo (Settings → Pages → Source:
GitHub Actions) and it deploys automatically on every push to `main`.

## What it shows

- District average trend across all tracked months
- Score-band distribution (0% / 1–49% / 50–75% / >75%) across all competencies
- Full competency ranking table (sortable), with month-over-month change
- Grade × subject best/weakest competency breakdown
- Block-level ranking and leaderboard
- School-level highlights: highest zero-scorer counts, biggest improvers, sharpest
  decliners
- Automatic **low-coverage warning** for any month whose school count is far below
  the others (e.g. a month whose data collection is still in progress) — so partial
  data never gets silently presented as a finished trend

## Quickstart

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Works immediately using the bundled CSV snapshot
in `public/data/` (April–June 2026, Basti district).

## Architecture

- **React + Vite**, no backend — deploys as a static site (GitHub Pages).
- **Data model is long-format**: one row per school per month
  (`Month, Block, School, <23 competency columns>`). Adding a month means adding
  rows, never new columns or new sheets — see `src/lib/analysis.js`, which computes
  every average, ranking, and distribution dynamically from however many months are
  present.
- **Data source** is CSV, fetched client-side (`src/lib/csv.js`) from either:
  - the bundled snapshot in `public/data/` (default, works with no setup), or
  - a Google Sheet published to the web as CSV, for live updates without redeploying
    — see [`SETUP.md`](./SETUP.md) for the full walkthrough and how to add new
    months going forward.
- **Charts**: [Recharts](https://recharts.org/). Colors and chart conventions follow
  a validated accessible palette (see `src/styles/theme.css`) — categorical hues in
  fixed order, status colors reserved for score bands, dark mode is a first-class
  second pass rather than an automatic invert.

## Project layout

```
src/
  lib/analysis.js     — all metric computation (averages, deltas, rankings, bands)
  lib/csv.js           — fetch + parse CSV from config.js sources
  lib/format.js        — number/percent formatting helpers
  config.js            — data source URLs (bundled CSV by default; see SETUP.md)
  components/          — dashboard UI pieces
  styles/theme.css      — color tokens (light/dark), from the dataviz palette
data-prep/
  build_long_format.py — regenerates public/data/*.csv from raw monthly Excel files
                          (only needed if you're rebuilding the CSV snapshot itself,
                          not for normal month-to-month updates — see SETUP.md)
```

## Deploying

1. Push this repo to GitHub.
2. In the repo settings, go to **Pages** and set Source to **GitHub Actions**.
3. Push to `main` — `.github/workflows/deploy.yml` builds and deploys automatically.

## Adding a new month of data

If you've connected a Google Sheet (recommended — see `SETUP.md`): just append rows
to the `Raw_Scores` tab. The live site updates without any redeploy.

If you're staying on the bundled CSV snapshot instead: add the new month's raw Excel
file, update `data-prep/build_long_format.py`'s `MONTHS` list, rerun it, commit the
regenerated `public/data/*.csv`, and push.
