# Auto-updating from Google Drive

The dashboard reads the NIPUN+ "School Wise Competency Wise Data" folder on the
Central Square Foundation Drive:
https://drive.google.com/drive/folders/1XmVzEYtlrOJO02qZMc21FStVWC1k-kz9

That folder is only visible inside the CSF domain, so GitHub can't read it
directly. A small Apps Script (`exporter/Code.js`), running as your CSF account,
does it instead:

```
Drive folder (month folders: "Aug 2026", "July 2026/Grades 1-5 (Updated)", ...)
   │  exporter/Code.js — every night at 03:00 IST, as your CSF account
   │  • Basti files only • new or changed files only • copied unchanged
   ▼
data/raw/<YYYY-MM>/<file>                  one commit per run
   │  .github/workflows/build-data.yml
   ▼
data-prep/build_data.py  ->  public/data/basti.json  ->  GitHub Pages
```

Once it's set up, adding a month needs nothing: drop the month's files in a new
month folder in Drive (named like `Sep 2026`) and the site shows it the next
morning. A file that is re-uploaded or edited is picked up again.

## One-time setup (~10 minutes)

**1. Make a GitHub token**
GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
- Repository access: **Only select repositories** → `NIPUN-Basti-Dashboard`
- Permissions: **Contents → Read and write**
- Copy the token.

**2. Create the Apps Script project** (signed in as your CSF account)
1. Go to [script.google.com](https://script.google.com) → **New project**, name it
   "NIPUN+ Basti dashboard exporter".
2. Replace the contents of `Code.gs` with `exporter/Code.js` from this repo.
3. Project Settings (gear) → tick **Show "appsscript.json" manifest file** → open
   `appsscript.json` in the editor and replace it with `exporter/appsscript.json`.
4. Project Settings → **Script properties** → Add property `GITHUB_TOKEN` = the token.

**3. Start it**
In the editor choose `setup` → **Run** → approve the permissions (read Drive,
connect to GitHub, run on a schedule). It creates the nightly trigger and runs the
first export straight away.

## Useful functions (run from the editor)

| Function | What it does |
|---|---|
| `runExport` | Export now instead of waiting for the night |
| `status` | Shows the last run and which files are waiting |
| `resetState` | Forget what was exported, so the next run re-sends everything |

## Rules the build follows

- **Basti only.** Files whose name contains "basti".
- **Month** comes from the month folder's name ("Aug 2026" → 2026-08).
- **Several Basti files in one month** (e.g. July's "Grades 1-3" and
  "Grades 1-5 (Updated)"): a file from a folder with "Updated" in its name wins.
- **Both export formats are read** — see the Definitions page on the dashboard.

## Learning outcome names

Most codes in the Jul 2026+ exports (H105, M201.1, …) have no description in the
exports themselves. Add or fix names in `data-prep/lo_descriptions.csv`
(`Code,Desc`); the site rebuilds when that file changes.

## Troubleshooting

| Problem | Fix |
|---|---|
| A new month doesn't appear | Run `status` in Apps Script. Check the month folder is named like `Sep 2026` and the file name contains "Basti". Then check the "Build dashboard data" run in the repo's Actions tab. |
| Apps Script says GitHub 401/403 | The token expired or lacks Contents: Read and write on this repo. Make a new one and update `GITHUB_TOKEN`. |
| The build fails on a new file | The export layout changed. The Action's log names the file and the problem; `data-prep/build_data.py` handles the parsing. |
