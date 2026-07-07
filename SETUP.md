# Going live: connect a Google Sheet

The dashboard works right now with no setup (it reads a bundled snapshot). This guide
is only for making it **live**, so editing a Google Sheet updates the website with no
code changes.

Do part A once. Then every future month is just part B.

---

## Part A — one-time setup (~10 minutes)

**Step 1: Import the data into a new Google Sheet**
1. Go to [sheets.google.com](https://sheets.google.com) → blank spreadsheet.
2. `File → Import → Upload` → choose `data-prep/Basti_Sheets_Import.xlsx` from this repo.
3. Choose **"Insert new sheet(s)"** when asked.
4. Delete the empty `Sheet1` tab if one was created.

You should now have two tabs: `Raw_Scores` and `Competency_Meta`.

**Step 2: Publish `Raw_Scores` as a CSV link**
1. `File → Share → Publish to web`.
2. First dropdown: choose **Raw_Scores** (not "Entire document").
3. Second dropdown: choose **Comma-separated values (.csv)**.
4. Click **Publish** → copy the link it gives you.

**Step 3: Publish `Competency_Meta` as a CSV link**
- Repeat step 2, choosing the **Competency_Meta** tab instead. Copy that link too.

You now have two links, both ending in `output=csv`.

**Step 4: Paste both links into the app**
1. Open `src/config.js` in this repo.
2. Paste your two links in:
   ```js
   const GOOGLE_SHEETS_RAW_SCORES_URL = 'paste your Raw_Scores link here'
   const GOOGLE_SHEETS_COMPETENCY_META_URL = 'paste your Competency_Meta link here'
   ```
3. Save, commit, and push to GitHub.

That's it — the deployed site now reads live from your Google Sheet.

---

## Part B — adding a new month (every month, ~2 minutes)

1. Open the Google Sheet → `Raw_Scores` tab.
2. Go to the bottom of the sheet and paste in the new month's rows.
3. Use the **same column order** as the existing rows — don't add new columns, don't
   make a new tab. Just new rows at the bottom.
   - `Month` column: `YYYY-MM`, e.g. `2026-07`.
   - `MonthLabel` column: what should be displayed, e.g. `July`.
4. Done. Reload the website (wait a minute or two if it doesn't show up right away —
   Google's CSV cache refreshes on a short delay).

No code, no rebuild, no redeploy. The new month appears in every chart and ranking
automatically, and gets flagged as "preliminary" on its own if it has far fewer
schools than the other months so far.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Site shows old/no data | Re-check `Publish to web` is still on for both tabs, and the links in `config.js` match exactly (including the `gid=` part) |
| New month doesn't show up | Check `Month` is `YYYY-MM`, and competency column headers match `Competency_Meta` exactly |
| A number looks wrong | Blank cells mean "not assessed" and are excluded from averages — they are not counted as a zero score |
