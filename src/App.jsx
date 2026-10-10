import { useEffect, useMemo, useState } from 'react'
import { GRADES, SUBJECTS, loadData } from './lib/data.js'
import { Select } from './components/ui.jsx'
import Overview from './pages/Overview.jsx'
import Competencies from './pages/Competencies.jsx'
import Blocks from './pages/Blocks.jsx'
import Schools from './pages/Schools.jsx'
import SchoolDetail from './pages/SchoolDetail.jsx'
import Compare from './pages/Compare.jsx'
import Checks from './pages/Checks.jsx'
import About from './pages/About.jsx'

const NAV = [
  { path: 'overview', label: 'Overview', icon: '◧' },
  { path: 'competencies', label: 'Learning outcomes', icon: '▤' },
  { path: 'blocks', label: 'Blocks', icon: '▦' },
  { path: 'schools', label: 'Schools', icon: '◉' },
  { path: 'checks', label: 'Suspicious results', icon: '⚑', child: true },
  { path: 'compare', label: 'Compare with CSF', icon: '⇄' },
  { path: 'about', label: 'Definitions', icon: 'ⓘ' },
]

const FILTER_KEYS = ['m', 'block', 'grade', 'subject', 'area', 'lo']
const NO_FILTERBAR = new Set(['compare', 'about', 'checks'])

// Route + filters both live in the hash so any view can be shared as a link:
// #/schools?m=2026-08&block=Gaur&grade=2
function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  return { page: parts[0] || 'overview', id: parts[1] ?? null, params: Object.fromEntries(new URLSearchParams(query)) }
}

function buildHash(page, id, filters) {
  const q = new URLSearchParams()
  for (const k of FILTER_KEYS) if (filters[k]) q.set(k, filters[k])
  const qs = q.toString()
  return `#/${page}${id != null ? `/${id}` : ''}${qs ? `?${qs}` : ''}`
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    loadData().then(setData, (e) => setError(e.message))
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const filters = useMemo(() => {
    const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, route.params[k] || '']))
    if (data && !data.months.some((m) => m.key === f.m)) f.m = data.months[data.months.length - 1].key
    return f
  }, [route.params, data])

  if (error) return <div className="fatal">Could not load the dashboard data: {error}</div>
  if (!data) return <div className="loading">Loading NIPUN+ Basti data…</div>

  const nav = (page, id = null, next = filters) => {
    window.location.hash = buildHash(page, id, next)
    window.scrollTo(0, 0)
  }
  const setFilters = (patch) => {
    window.location.hash = buildHash(route.page, route.id, { ...filters, ...patch })
  }
  const latest = data.months[data.months.length - 1]
  const props = { data, filters, setFilters, nav }

  let body
  switch (route.page) {
    case 'competencies':
      body = <Competencies {...props} />
      break
    case 'blocks':
      body = <Blocks {...props} />
      break
    case 'schools':
      body = route.id ? <SchoolDetail {...props} udise={route.id} /> : <Schools {...props} />
      break
    case 'checks':
      body = <Checks {...props} />
      break
    case 'compare':
      body = <Compare {...props} />
      break
    case 'about':
      body = <About {...props} />
      break
    default:
      body = <Overview {...props} />
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">NIPUN+ Basti · Learning Outcomes</div>
        <div className="topbar-meta">
          Basti district · {data.months[0].label} – {latest.label}
        </div>
      </header>
      <div className="layout">
        <nav className="sidebar" aria-label="Pages">
          <div className="sidebar-head">
            <div className="sidebar-title">Dashboard</div>
            <div className="sidebar-sub">NIPUN+ school-wise, competency-wise results · Basti</div>
          </div>
          {NAV.map((n) => (
            <a key={n.path} href={buildHash(n.path, null, filters)} className={`nav-item${n.child ? ' nav-child' : ''}${route.page === n.path ? ' active' : ''}`} aria-current={route.page === n.path ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </a>
          ))}
        </nav>
        <main className="main" id="main">
          {!NO_FILTERBAR.has(route.page) && <FilterBar data={data} filters={filters} setFilters={setFilters} />}
          {body}
        </main>
      </div>
    </div>
  )
}

function FilterBar({ data, filters, setFilters }) {
  const active = ['block', 'grade', 'subject', 'area', 'lo'].some((k) => filters[k])
  const los = data.los.filter((l) => (!filters.grade || l.grade === filters.grade) && (!filters.subject || l.subject === filters.subject))
  return (
    <div className="filterbar" role="search" aria-label="Filters">
      <Select
        label="Month"
        value={filters.m}
        onChange={(m) => setFilters({ m })}
        options={[...data.months].reverse().map((m) => ({ value: m.key, label: `${m.label}${m.lowCoverage ? ' (few schools)' : ''}` }))}
      />
      <Select label="Block" value={filters.block} onChange={(block) => setFilters({ block })} placeholder="All blocks" options={data.blocks.map((b) => ({ value: b, label: b }))} />
      <Select
        label="Grade"
        value={filters.grade}
        onChange={(grade) => setFilters({ grade, lo: '' })}
        placeholder="All grades"
        options={GRADES.map((g) => ({ value: g, label: `Grade ${g}` }))}
      />
      <Select label="Subject" value={filters.subject} onChange={(subject) => setFilters({ subject, lo: '' })} placeholder="Hindi & Maths" options={SUBJECTS.map((s) => ({ value: s, label: s }))} />
      <Select
        label="Learning outcome"
        value={filters.lo}
        onChange={(lo) => setFilters({ lo })}
        placeholder="All learning outcomes"
        options={los.map((l) => ({ value: l.code, label: `G${l.grade} · ${l.label}` }))}
      />
      <Select
        label="Area"
        value={filters.area}
        onChange={(area) => setFilters({ area })}
        placeholder="Rural & urban"
        options={[
          { value: 'R', label: 'Rural' },
          { value: 'U', label: 'Urban' },
        ]}
      />
      {active && (
        <button className="btn btn-ghost" onClick={() => setFilters({ block: '', grade: '', subject: '', area: '', lo: '' })}>
          Clear filters
        </button>
      )}
    </div>
  )
}
