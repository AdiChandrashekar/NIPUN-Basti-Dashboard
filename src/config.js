// Data source configuration.
//
// By default the dashboard reads the CSV snapshots bundled in /public/data
// (April-June 2026), so it works immediately with no setup.
//
// To make it live-update from Google Sheets: publish the Raw_Scores and
// Competency_Meta tabs to the web as CSV (File > Share > Publish to web >
// select sheet > CSV), then paste the two URLs below. See SETUP.md for the
// full walkthrough, including how to add a new month later.
//
// You can also override these at build time with a .env file:
//   VITE_RAW_SCORES_URL=...
//   VITE_COMPETENCY_META_URL=...

const GOOGLE_SHEETS_RAW_SCORES_URL = '' // <- paste published CSV URL here
const GOOGLE_SHEETS_COMPETENCY_META_URL = '' // <- paste published CSV URL here

export const dataSources = {
  rawScoresUrl:
    import.meta.env.VITE_RAW_SCORES_URL || GOOGLE_SHEETS_RAW_SCORES_URL || `${import.meta.env.BASE_URL}data/Raw_Scores.csv`,
  competencyMetaUrl:
    import.meta.env.VITE_COMPETENCY_META_URL ||
    GOOGLE_SHEETS_COMPETENCY_META_URL ||
    `${import.meta.env.BASE_URL}data/Competency_Meta.csv`,
}

export const isUsingGoogleSheets = Boolean(
  import.meta.env.VITE_RAW_SCORES_URL || GOOGLE_SHEETS_RAW_SCORES_URL
)
