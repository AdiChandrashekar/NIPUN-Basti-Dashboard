import { useEffect, useMemo, useState } from 'react'
import { loadData } from './lib/csv'
import { dataSources, isUsingGoogleSheets } from './config'
import {
  computeBlockStats,
  computeCompetencyStats,
  computeSchoolTable,
  getMonthList,
  gradeWiseBestWorst,
  topBottomCompetencies,
} from './lib/analysis'

import ThemeToggle from './components/ThemeToggle'
import MonthBadges from './components/MonthBadges'
import CoverageBanner from './components/CoverageBanner'
import KpiCards from './components/KpiCards'
import Tabs from './components/Tabs'
import FilterBar from './components/FilterBar'
import TrendChart from './components/TrendChart'
import CompetencyTable from './components/CompetencyTable'
import DistributionChart from './components/DistributionChart'
import BlockLeaderboard from './components/BlockLeaderboard'
import GradeBreakdown from './components/GradeBreakdown'
import SchoolsTable from './components/SchoolsTable'
import CompareView from './components/CompareView'

const TABS = ['Overview', 'Competencies', 'Blocks', 'Schools', 'Compare']
const EMPTY_FILTERS = { month: '', blocks: [], grades: [], subjects: [], competencies: [] }

export default function App() {
  const [state, setState] = useState({ status: 'loading' })
  const [tab, setTab] = useState('Overview')
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  useEffect(() => {
    let cancelled = false
    loadData(dataSources)
      .then(({ rows, meta }) => {
        if (cancelled) return
        if (!rows.length) throw new Error('No rows found in data source.')
        setState({ status: 'ready', rows, meta })
        const months = getMonthList(rows)
        setFilters((f) => ({ ...f, month: months[months.length - 1]?.key ?? '' }))
      })
      .catch((err) => {
        if (cancelled) return
        setState({ status: 'error', error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const base = useMemo(() => {
    if (state.status !== 'ready') return null
    const months = getMonthList(state.rows)
    const allBlocks = [...new Set(state.rows.map((r) => r.Block))].sort()
    return { rows: state.rows, meta: state.meta, months, allBlocks }
  }, [state])

  const filtered = useMemo(() => {
    if (!base) return null
    const { rows, meta, months, allBlocks } = base
    const filteredRows = filters.blocks.length ? rows.filter((r) => filters.blocks.includes(r.Block)) : rows
    const filteredMeta = meta.filter(
      (c) =>
        (filters.grades.length === 0 || filters.grades.includes(c.Grade)) &&
        (filters.subjects.length === 0 || filters.subjects.includes(c.Subject)) &&
        (filters.competencies.length === 0 || filters.competencies.includes(c.Code))
    )
    const competencyStats = computeCompetencyStats(filteredRows, filteredMeta)
    const blockStats = computeBlockStats(filteredRows, filteredMeta)
    const month = filters.month && competencyStats.byMonth[filters.month] ? filters.month : months[months.length - 1]?.key
    if (!month) return null
    const schoolTable = computeSchoolTable(filteredRows, filteredMeta, month)
    const tb = topBottomCompetencies(competencyStats, month)
    const grades = gradeWiseBestWorst(competencyStats, month)
    const monthBlocks = blockStats.byMonth[month] || []
    const topBlock = [...monthBlocks].filter((b) => b.overall !== null).sort((a, b) => b.overall - a.overall)[0]
    const currentMonthInfo = months.find((m) => m.key === month)
    const filteredMonthN = filteredRows.filter((r) => r.Month === month).length
    const filteredBlockCount = monthBlocks.filter((b) => b.n > 0).length
    const filteredMonthInfo = currentMonthInfo && {
      ...currentMonthInfo,
      n: filteredMonthN,
      blockCount: filteredBlockCount,
    }
    return {
      filteredRows,
      filteredMeta,
      allBlocks,
      filteredMonthInfo,
      months,
      month,
      currentMonthInfo,
      competencyStats,
      blockStats,
      schoolTable,
      tb,
      grades,
      monthBlocks,
      topBlock,
    }
  }, [base, filters])

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
  if (!filtered) {
    return <div className="loading">Preparing dashboard…</div>
  }

  const {
    filteredRows, filteredMeta, allBlocks, months, month, currentMonthInfo, filteredMonthInfo,
    competencyStats, blockStats, schoolTable, tb, grades, topBlock,
  } = filtered

  const defaultBlocks = [...blockStats.byMonth[month]]
    .filter((b) => b.overall !== null)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 3)
    .map((b) => b.block)
  const defaultCompetencies = tb.bottom.slice(0, 5).map((c) => c.code)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>NIPUN Basti — Competency Dashboard</h1>
          <p>School-wise learning outcome tracking, {months[0]?.label}–{months[months.length - 1]?.label} 2026</p>
          <MonthBadges months={months} />
        </div>
        <ThemeToggle />
      </header>

      <CoverageBanner month={currentMonthInfo} />

      <FilterBar
        months={months}
        blocks={allBlocks}
        competencyMeta={base.meta}
        filters={filters}
        setFilters={setFilters}
      />

      <KpiCards
        districtAvgByMonth={competencyStats.districtAvgByMonth}
        selectedMonthKey={month}
        monthInfo={filteredMonthInfo}
        topBlock={topBlock}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <>
          <section className="panel">
            <h2>District average over time</h2>
            <p className="panel-sub">Mean of the currently filtered competencies, by month</p>
            <TrendChart data={competencyStats.districtAvgByMonth} />
          </section>
          <section className="panel">
            <h2>Score band distribution</h2>
            <p className="panel-sub">Average share of schools in each score band, across filtered competencies</p>
            <DistributionChart byMonth={competencyStats.byMonth} months={months} />
          </section>
          <section className="panel">
            <h2>Grade-wise best &amp; weakest competency</h2>
            <p className="panel-sub">{currentMonthInfo?.label} — highest/lowest average within each grade &amp; subject group</p>
            <GradeBreakdown groups={grades} />
          </section>
        </>
      )}

      {tab === 'Competencies' && (
        <section className="panel">
          <h2>Competencies — {currentMonthInfo?.label}</h2>
          <p className="panel-sub">Sortable · change shown vs previous month · respects active filters</p>
          <CompetencyTable perComp={competencyStats.byMonth[month].perComp} deltas={competencyStats.deltas[month]} />
        </section>
      )}

      {tab === 'Blocks' && (
        <section className="panel">
          <h2>Block ranking — {currentMonthInfo?.label}</h2>
          <p className="panel-sub">Overall average across filtered competencies, by block</p>
          <BlockLeaderboard data={blockStats.byMonth[month]} />
        </section>
      )}

      {tab === 'Schools' && (
        <section className="panel">
          <h2>All schools — {currentMonthInfo?.label}</h2>
          <p className="panel-sub">Sortable, searchable · averages computed over the currently filtered competencies</p>
          <SchoolsTable data={schoolTable.rows} prevMonthLabel={schoolTable.prevMonth?.label} compCount={filteredMeta.length} />
        </section>
      )}

      {tab === 'Compare' && (
        <CompareView
          rows={filteredRows}
          meta={filteredMeta}
          blocks={blockStats.blocks}
          competencyMeta={filteredMeta}
          selectedMonth={month}
          defaultBlocks={defaultBlocks}
          defaultCompetencies={defaultCompetencies}
        />
      )}

      <p className="footer-note">
        {isUsingGoogleSheets ? 'Live data from Google Sheets.' : 'Using bundled CSV snapshot — connect a Google Sheet in src/config.js for live updates.'}
        {' '}Add a new month by appending rows to Raw_Scores — see SETUP.md.
      </p>
    </div>
  )
}
