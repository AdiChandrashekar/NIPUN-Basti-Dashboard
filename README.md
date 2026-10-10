# NIPUN+ Basti — Learning Outcomes Dashboard

A dashboard of the monthly NIPUN+ school-wise, competency-wise results for Basti
district, with a comparison against the Partner Org's own assessment. It shares
its design system (layout, palette, charts) with the ARP Visit Monitoring
dashboard.

Live: https://adichandrashekar.github.io/NIPUN-Basti-Dashboard/

**Pages**

- **Overview**: average school result, schools and children assessed, score bands,
  grade × subject over time, block ranking, learning outcomes to watch.
- **Learning outcomes**: every LO × every month heatmap, with a detail panel (trend,
  spread of school results, blocks) and a sortable table.
- **Blocks**: ranking, block × month heatmap, table.
- **Schools**: every school, searchable; click one for its LO × month results.
- **Compare with Partner Org**: does NIPUN+ agree with the Partner Org's own
  assessment? Same grade, same quarter, same schools, one measure per subject:
  headline gap, a band agreement matrix, a school scatter, blocks, and a list of
  schools where the two disagree most.
- **Definitions**: how every number is calculated.

Filters (month, block, grade, subject, learning outcome, area) apply to every page
and live in the URL, so any view can be shared as a link. Every chart has a
**Table** view.

## Data

The data updates itself from the shared Drive folder: a nightly Apps Script copies
new Basti files into `data/raw/`, and a GitHub Action rebuilds
`public/data/basti.json` and redeploys. Setup and rules: [`SETUP.md`](./SETUP.md).

To rebuild by hand:

```bash
pip install -r data-prep/requirements.txt
python data-prep/build_data.py
```

## Development

```bash
npm install
npm run dev
```

React + Vite, no backend. Charts are plain SVG (`src/components/charts.jsx`).

```
exporter/            Apps Script: Drive folder -> data/raw (runs as a CSF account)
data/raw/            raw NIPUN+ exports, one folder per month (written by the exporter)
data-prep/           build_data.py -> public/data/basti.json; LO names in lo_descriptions.csv
src/lib/data.js      every metric on the dashboard
src/lib/partner.js   Partner Org backend and block-name matching
src/lib/compare.js   NIPUN+ vs Partner Org matching and aggregation
src/pages/           one file per page
```
