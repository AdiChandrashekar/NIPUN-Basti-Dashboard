import { useEffect, useMemo, useState } from 'react'
import { loadData } from './lib/csv'
import { dataSources, isUsingGoogleSheets } from './config'
import {
  computeBlockStats,
  computeCompetencyStats,
  computeSchoolHighlights,
  getMonthList,
  gradeWiseBestWorst,
  topBottomCompetencies,
} from './lib/analysis'

import ThemeToggle from './components/ThemeToggle'
import MonthBadges from './components/MonthBadges'
import CoverageBanner from './components/CoverageBanner'
import KpiCards from './components/KpiCards'
import Tabs from './components/Tabs'
import TrendChart from './components/TrendChart'
import CompetencyTable from './components/CompetencyTable'
import DistributionChart from './components/DistributionChart'
import BlockLeaderboard from './components/BlockLeaderboard'
import GradeBreakdown from './components/GradeBreakdown'
import SchoolHighlights from './components/SchoolHighlights'

const TABS = ['Overview', 'Competencies', 'Blocks', 'Schools']

export default function App() {
  const [state, setState] = useState({ status: 'loading' })
  const [tab, setTab] = useState('Overview')

  useEffect(() => {
    let cancelled = false
    loadData(dataSources)
      .then(({ rows, meta }) => {
        if (cancelled) return
        if (!rows.length) throw new Error('No rows found in data source.')
        setState({ status: 'ready', rows, meta })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ status: 'error', error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const analysis = useMemo(() => {
    if (state.status !== 'ready') return null
    const { rows, meta } = state
    const months = getMonthList(rows)
    const competencyStats = computeCompetencyStats(rows, meta)
    const blockStats = computeBlockStats(rows, meta)
    const schoolHighlights = computeSchoolHighlights(rows, meta)
    const latestMonth = months[months.length - 1]
    const tb = topBottomCompetencies(competencyStats, latestMonth.key)
    const grades = gradeWiseBestWorst(competencyStats, latestMonth.key)
    const latestBlocks = blockStats.byMonth[latestMonth.key]
    const topBlock = [...latestBlocks].filter((b) => b.overall !== null).sort((a, b) => b.overall - a.overall)[0]
    return { months, competencyStats, blockStats, schoolHighlights, latestMonth, tb, grades, topBlock }
  }, [state])

  if (state.status === 'loading') {
    return <div className="loading">Loading NIPUN Basti data…</div>
  }
  if (state.status === 'error') {
    return (
      <div className="error-box">
        <p>Couldn't load the dashboard data: {state.error}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          If you've connected a Google Sheet, check that it's published to the web as CSV and that the
          URLs in <code>src/config.js</code> are correct. See SETUP.md.
        </p>
      </div>
    )
  }

  const { months, competencyStats, blockStats, schoolHighlights, latestMonth, tb, grades, topBlock } = analysis

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>NIPUN Basti — Competency Dashboard</h1>
          <p>School-wise learning outcome tracking, {months[0]?.label}–{latestMonth?.label} 2026</p>
          <MonthBadges months={months} />
        </div>
        <ThemeToggle />
      </header>

      <CoverageBanner month={latestMonth} />

      <KpiCards districtAvgByMonth={competencyStats.districtAvgByMonth} latestMonth={latestMonth} topBlock={topBlock} />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <>
          <section className="panel">
            <h2>District average over time</h2>
            <p className="panel-sub">Mean of all 23 competency averages, by month</p>
            <TrendChart data={competencyStats.districtAvgByMonth} />
          </section>
          <section className="panel">
            <h2>Score band distribution</h2>
            <p className="panel-sub">Average share of schools in each score band, across all competencies</p>
            <DistributionChart byMonth={competencyStats.byMonth} months={months} />
          </section>
          <section className="panel">
            <h2>Grade-wise best &amp; weakest competency</h2>
            <p className="panel-sub">{latestMonth?.label} — highest/lowest average within each grade &amp; subject group</p>
            <GradeBreakdown groups={grades} />
          </section>
        </>
      )}

      {tab === 'Competencies' && (
        <section className="panel">
          <h2>All competencies — {latestMonth?.label}</h2>
          <p className="panel-sub">Sortable · change shown vs previous month</p>
          <CompetencyTable
            perComp={competencyStats.byMonth[latestMonth.key].perComp}
            deltas={competencyStats.deltas[latestMonth.key]}
          />
        </section>
      )}

      {tab === 'Blocks' && (
        <section className="panel">
          <h2>Block ranking — {latestMonth?.label}</h2>
          <p className="panel-sub">Overall average across all competencies, by block</p>
          <BlockLeaderboard data={blockStats.byMonth[latestMonth.key]} />
        </section>
      )}

      {tab === 'Schools' && (
        <section className="panel">
          <h2>School-level highlights — {latestMonth?.label}</h2>
          <p className="panel-sub">Individual schools worth a closer look</p>
          <SchoolHighlights {...schoolHighlights} />
        </section>
      )}

      <p className="footer-note">
        {isUsingGoogleSheets ? 'Live data from Google Sheets.' : 'Using bundled CSV snapshot — connect a Google Sheet in src/config.js for live updates.'}
        {' '}Add a new month by appending rows to Raw_Scores — see SETUP.md.
      </p>
    </div>
  )
}
