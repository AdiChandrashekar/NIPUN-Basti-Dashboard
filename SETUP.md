# Connecting the dashboard to a live Google Sheet

By default this dashboard reads a bundled CSV snapshot (`public/data/*.csv`, April–June
2026) so it works immediately with zero setup. To make it **live** — so that editing a
Google Sheet updates the deployed site without touching code — follow the steps below.

This is a one-time setup. After it's done, **adding a new month is just adding rows to
a spreadsheet** (see the last section).

## 1. Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet.
2. `File > Import > Upload`, choose `data-prep/Basti_Sheets_Import.xlsx` from this repo.
3. When prompted, choose **"Insert new sheet(s)"** (not "Replace spreadsheet") so both
   tabs come in cleanly: `Raw_Scores` and `Competency_Meta`.
4. Delete the default empty `Sheet1` tab if it's still there.
5. Rename the spreadsheet to something like "NIPUN Basti Tracker".

You should end up with exactly two tabs:

- **Raw_Scores** — one row per school per month. Columns: `Month, MonthLabel, Block,
  Arrtype, SchoolCode, School, Total, H104.2, H106.1, … H301` (23 competency columns).
- **Competency_Meta** — one row per competency code: `Code, Desc, Grade, Subject`.
  You won't need to touch this again unless the assessment adds/removes competencies.

## 2. Publish both tabs to the web as CSV

Google Sheets can serve a single tab as a live, public, read-only CSV link — that's
what the dashboard fetches.

1. `File > Share > Publish to web`.
2. In the first dropdown, select **Raw_Scores** (not "Entire Document").
3. In the second dropdown, select **Comma-separated values (.csv)**.
4. Click **Publish**, confirm, and copy the URL it gives you.
5. Repeat steps 2–4, this time selecting the **Competency_Meta** tab.

You'll end up with two URLs that look like:
```
https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=123456&single=true&output=csv
```

Keep both — you need them for the next step. (This published link is **read-only** —
viewers can never edit your sheet through it, and it does not require anyone to be
logged into Google.)

## 3. Point the dashboard at those URLs

Open `src/config.js` and paste the two URLs in:

```js
const GOOGLE_SHEETS_RAW_SCORES_URL = 'https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&output=csv'
const GOOGLE_SHEETS_COMPETENCY_META_URL = 'https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&output=csv'
```

Commit and push. GitHub Actions rebuilds and redeploys automatically (see the repo's
Actions tab). From now on, the **live site reads directly from the Google Sheet** —
you don't need to push code again to update data.

(Alternative for local dev only: set `VITE_RAW_SCORES_URL` and
`VITE_COMPETENCY_META_URL` in a `.env` file instead of editing `config.js` — either
works, but only editing `config.js` and pushing will update the deployed GitHub Pages
site, since Vite env vars are baked in at build time.)

## 4. Adding a new month later

This is the part that "just works" once the above is set up:

1. Open the Google Sheet, go to the **Raw_Scores** tab.
2. Scroll to the bottom and paste in the new month's rows, in the exact same column
   order: `Month, MonthLabel, Block, Arrtype, SchoolCode, School, Total`, then the 23
   competency score columns.
   - `Month` must be `YYYY-MM` format (e.g. `2026-07`) — the dashboard sorts
     chronologically by this value.
   - `MonthLabel` is what's displayed (e.g. `July`).
   - Column headers themselves never change — you're only ever adding **rows**, never
     new columns or new tabs.
3. That's it. Reload the deployed dashboard (may take a minute or two for Google's
   publish cache to refresh) — the new month appears automatically in every chart,
   table, and ranking. No code changes, no redeploy.

The dashboard automatically:
- Adds the new month to the trend line and all month-over-month comparisons
- Flags the new month as **"partial / preliminary"** (shown with a warning banner) if
  its school count is under 30% of the largest month on file — exactly like June 2026
  was flagged in this dataset. That warning clears on its own once coverage catches up.

## Troubleshooting

- **Dashboard shows old / no data**: confirm `File > Share > Publish to web` is still
  active for both tabs (it can be revoked if someone re-shares the sheet), and that
  the URLs in `config.js` exactly match what Google gave you (including the `gid=`
  parameter, which is tab-specific).
- **A new month doesn't show up**: double check the `Month` column uses `YYYY-MM` and
  that competency column headers match `Competency_Meta`'s `Code` column exactly
  (including spacing, e.g. `M 101.1 (A)`).
- **Numbers look wrong**: blank/non-numeric cells in a competency column are treated
  as "not assessed" and excluded from averages — they are not treated as zero.
