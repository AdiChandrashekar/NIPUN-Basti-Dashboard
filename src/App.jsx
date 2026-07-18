import { useEffect, useMemo, useState } from 'react'
import { loadData } from './lib/csv'
import { dataSources, isUsingGoogleSheets } from './config'
import { getMonthList } from './lib/analysis'

import CompareLanding from './components/compare/CompareLanding'
import OverviewPage from './pages/OverviewPage'
import CompetenciesPage from './pages/CompetenciesPage'
import BlocksPage from './pages/BlocksPage'
import SchoolsPage from './pages/SchoolsPage'
import ComparePage from './pages/ComparePage'

const PAGES = [
  { key: 'Overview', component: OverviewPage },
  { key: 'Competencies', component: CompetenciesPage },
  { key: 'Blocks', component: BlocksPage },
  { key: 'Schools', component: SchoolsPage },
  { key: 'Compare', component: ComparePage },
]

export default function App() {
  const [state, setState] = useState({ status: 'loading' })
  const [page, setPage] = useState('Overview')
  const [view, setView] = useState('dashboard') // 'dashboard' | 'compare'

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

  const base = useMemo(() => {
    if (state.status !== 'ready') return null
    const months = getMonthList(state.rows)
    const allBlocks = [...new Set(state.rows.map((r) => r.Block))].sort()
    return { rows: state.rows, meta: state.meta, months, allBlocks }
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">NIPUN Basti — Competency Dashboard</div>
          <nav className="view-toggle">
            {PAGES.map((p) => (
              <button
                key={p.key}
                type="button"
                className={view === 'dashboard' && page === p.key ? 'active' : ''}
                onClick={() => {
                  setView('dashboard')
                  setPage(p.key)
                }}
              >
                {p.key}
              </button>
            ))}
          </nav>
          <button type="button" className="chip" onClick={() => setView(view === 'dashboard' ? 'compare' : 'dashboard')}>
            {view === 'dashboard' ? 'Compare with SSP dashboard' : '← Back to dashboard'}
          </button>
        </div>
      </header>

      <div className="container">
        {view === 'compare' && <CompareLanding base={base} />}

        {PAGES.map((p) => (
          <div key={p.key} className={`page${view === 'dashboard' && page === p.key ? ' active' : ''}`}>
            <p.component base={base} />
          </div>
        ))}

        <p className="footer-note">
          {isUsingGoogleSheets ? 'Live data from Google Sheets.' : 'Using bundled CSV snapshot — connect a Google Sheet in src/config.js for live updates.'}
          {' '}Add a new month by appending rows to Raw_Scores — see SETUP.md.
        </p>
      </div>
    </div>
  )
}
