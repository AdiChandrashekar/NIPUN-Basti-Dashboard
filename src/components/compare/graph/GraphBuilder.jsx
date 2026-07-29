import { useEffect, useMemo, useRef, useState } from 'react'
import GraphChart from './GraphChart'
import { resolveGraphEntries } from '../../../lib/graphData'
import { exportSvgAsPng } from '../../../lib/exportPng'
import { exportRowsAsCsv } from '../../../lib/exportCsv'
import { SSP_COMPETENCIES, SSP_QUARTERS } from '../../../lib/sspTaxonomy'
import { fmtNum } from '../../../lib/format'

let nextId = 1
const genId = () => `g${nextId++}`

const VIEW_MODES = [
  { key: 'achievement', label: '% Achievement' },
  { key: 'distribution', label: 'Distribution Analysis' },
]

function sortPool(pool) {
  return [...pool].sort((a, b) => a.grade.localeCompare(b.grade) || a.subject.localeCompare(b.subject) || a.label.localeCompare(b.label))
}

function compositeKey(c) {
  return `${c.grade}|${c.code}`
}

function findByComposite(pool, composite) {
  if (!composite) return null
  const [grade, code] = composite.split('|')
  return pool.find((c) => c.grade === grade && c.code === code) || null
}

function CompetencyOptions({ pool }) {
  const groups = useMemo(() => {
    const m = new Map()
    pool.forEach((c) => {
      const key = `${c.grade} · ${c.subject}`
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(c)
    })
    return [...m.entries()]
  }, [pool])

  return groups.map(([label, items]) => (
    <optgroup label={label} key={label}>
      {items.map((c) => (
        <option key={compositeKey(c)} value={compositeKey(c)}>
          {c.label}
        </option>
      ))}
    </optgroup>
  ))
}

export default function GraphBuilder({ base }) {
  const nipunPool = useMemo(
    () => sortPool(base.meta.map((c) => ({ code: c.Code, label: c.Desc, grade: c.Grade, subject: c.Subject }))),
    [base.meta]
  )
  const partnerPool = useMemo(() => sortPool(SSP_COMPETENCIES), [])

  const [nipunMonth, setNipunMonth] = useState(base.months[base.months.length - 1]?.key ?? '')
  const [partnerQuarter, setPartnerQuarter] = useState(SSP_QUARTERS[0].key)
  const [paired, setPaired] = useState(true)
  const [viewMode, setViewMode] = useState('achievement')
  const [selections, setSelections] = useState([])

  const [draftNipun, setDraftNipun] = useState('')
  const [draftPartner, setDraftPartner] = useState('')
  const [draftSource, setDraftSource] = useState('nipun')
  const [draftSingle, setDraftSingle] = useState('')

  const [resolved, setResolved] = useState([])
  const [totals, setTotals] = useState({ nipunTotalSchools: 0, partnerTotalStudents: 0 })
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [error, setError] = useState(null)

  const chartRef = useRef(null)

  function togglePaired(next) {
    setPaired(next)
    setSelections([])
  }

  function addPair() {
    const n = findByComposite(nipunPool, draftNipun)
    const p = findByComposite(partnerPool, draftPartner)
    if (!n || !p) return
    setSelections((s) => [...s, { id: genId(), nipun: n, partner: p }])
    setDraftNipun('')
    setDraftPartner('')
  }

  function addSingle() {
    const pool = draftSource === 'nipun' ? nipunPool : partnerPool
    const c = findByComposite(pool, draftSingle)
    if (!c) return
    setSelections((s) => [...s, { id: genId(), source: draftSource, ref: c }])
    setDraftSingle('')
  }

  function removeAt(id) {
    setSelections((s) => s.filter((x) => x.id !== id))
  }

  function move(id, dir) {
    setSelections((s) => {
      const i = s.findIndex((x) => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.length) return s
      const copy = [...s]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  useEffect(() => {
    if (!selections.length) {
      setResolved([])
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('loading')
    setError(null)

    const refs = paired
      ? selections.flatMap((p) => [
          { id: `${p.id}-n`, source: 'nipun', ...p.nipun },
          { id: `${p.id}-p`, source: 'partner', ...p.partner },
        ])
      : selections.map((s) => ({ id: s.id, source: s.source, ...s.ref }))

    resolveGraphEntries({ refs, base, nipunMonth, partnerQuarter })
      .then(({ entries, partnerTotalStudents, nipunTotalSchools }) => {
        if (cancelled) return
        setResolved(entries)
        setTotals({ nipunTotalSchools, partnerTotalStudents })
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [selections, paired, nipunMonth, partnerQuarter, base])

  const chartRows = useMemo(() => {
    if (status !== 'ready') return []
    if (paired) {
      return selections
        .map((p) => ({
          id: p.id,
          nipun: resolved.find((r) => r.id === `${p.id}-n`),
          partner: resolved.find((r) => r.id === `${p.id}-p`),
        }))
        .filter((r) => r.nipun && r.partner)
    }
    return selections.map((s) => resolved.find((r) => r.id === s.id)).filter(Boolean)
  }, [status, resolved, selections, paired])

  const totalsText =
    status === 'ready' && chartRows.length
      ? `NIPUN+: ${totals.nipunTotalSchools.toLocaleString()} schools assessed · Partner Org: ${totals.partnerTotalStudents.toLocaleString()} students assessed`
      : ''

  const legendItems =
    viewMode === 'achievement'
      ? [
          { label: 'NIPUN+', color: '#1a3a5c' },
          { label: 'Partner Org', color: '#d97e1f' },
        ]
      : [
          { label: '0% (Zero)', color: '#c62828' },
          { label: '1–49%', color: '#ef6c5a' },
          { label: '50–75%', color: '#f5a623' },
          { label: '>75%', color: '#2d7a4a' },
          { label: 'NIPUN+ outline', color: '#1a3a5c' },
          { label: 'Partner Org outline', color: '#d97e1f' },
        ]

  async function handleExportPng() {
    if (!chartRef.current) return
    try {
      await exportSvgAsPng(chartRef.current, `nipun-partner-compare-${viewMode}-${Date.now()}.png`, { legendItems, footerText: totalsText })
    } catch (err) {
      setError(err.message)
    }
  }

  function handleExportCsv() {
    function rowFor(e, pairNum) {
      const row = {
        pair: pairNum ?? '',
        source: e.source === 'nipun' ? 'NIPUN+' : 'Partner Org',
        grade: e.grade,
        subject: e.subject,
        competency: e.label,
      }
      if (viewMode === 'achievement') {
        row.achieved = fmtNum(e.bandHigh * 100)
      } else {
        row.zero = fmtNum(e.bandZero * 100)
        row.low = fmtNum(e.bandLow * 100)
        row.mid = fmtNum(e.bandMid * 100)
        row.high = fmtNum(e.bandHigh * 100)
      }
      return row
    }

    const headers = [
      ...(paired ? [{ key: 'pair', label: 'Pair #' }] : []),
      { key: 'source', label: 'Source' },
      { key: 'grade', label: 'Grade' },
      { key: 'subject', label: 'Subject' },
      { key: 'competency', label: 'Competency' },
      ...(viewMode === 'achievement'
        ? [{ key: 'achieved', label: '% Achieved (>75%)' }]
        : [
            { key: 'zero', label: '0% (Zero)' },
            { key: 'low', label: '1–49%' },
            { key: 'mid', label: '50–75%' },
            { key: 'high', label: '>75%' },
          ]),
    ]

    const rows = paired
      ? chartRows.flatMap((r, i) => [rowFor(r.nipun, i + 1), rowFor(r.partner, i + 1)])
      : chartRows.map((e) => rowFor(e))

    exportRowsAsCsv(headers, rows, `nipun-partner-compare-${viewMode}-${Date.now()}.csv`)
  }

  return (
    <div className="graph-panel">
      <h3>Build a comparison graph</h3>
      <p className="panel-sub">
        Pick competencies from either side, pair them up (or not), then download the chart as a PNG or the numbers
        behind it as a CSV — ready to drop straight into an Excel chart.
      </p>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="graph-nipun-month">
            NIPUN+ Month
          </label>
          <select id="graph-nipun-month" className="month-select" value={nipunMonth} onChange={(e) => setNipunMonth(e.target.value)}>
            {base.months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="graph-partner-quarter">
            Partner Org Quarter
          </label>
          <select id="graph-partner-quarter" className="month-select" value={partnerQuarter} onChange={(e) => setPartnerQuarter(e.target.value)}>
            {SSP_QUARTERS.map((q) => (
              <option key={q.key} value={q.key}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
        <label className="graph-pair-toggle">
          <input type="checkbox" checked={paired} onChange={(e) => togglePaired(e.target.checked)} />
          Pair NIPUN+ with Partner Org competencies
        </label>
      </div>

      {paired ? (
        <div className="graph-add-row">
          <select className="month-select" value={draftNipun} onChange={(e) => setDraftNipun(e.target.value)}>
            <option value="">NIPUN+ competency…</option>
            <CompetencyOptions pool={nipunPool} />
          </select>
          <span className="graph-pair-arrow">↔</span>
          <select className="month-select" value={draftPartner} onChange={(e) => setDraftPartner(e.target.value)}>
            <option value="">Partner Org competency…</option>
            <CompetencyOptions pool={partnerPool} />
          </select>
          <button type="button" className="chip" disabled={!draftNipun || !draftPartner} onClick={addPair}>
            Add pair
          </button>
        </div>
      ) : (
        <div className="graph-add-row">
          <div className="chip-row">
            <button type="button" className={`chip${draftSource === 'nipun' ? ' active' : ''}`} onClick={() => { setDraftSource('nipun'); setDraftSingle('') }}>
              NIPUN+
            </button>
            <button type="button" className={`chip${draftSource === 'partner' ? ' active' : ''}`} onClick={() => { setDraftSource('partner'); setDraftSingle('') }}>
              Partner Org
            </button>
          </div>
          <select className="month-select" value={draftSingle} onChange={(e) => setDraftSingle(e.target.value)}>
            <option value="">Competency…</option>
            <CompetencyOptions pool={draftSource === 'nipun' ? nipunPool : partnerPool} />
          </select>
          <button type="button" className="chip" disabled={!draftSingle} onClick={addSingle}>
            Add
          </button>
        </div>
      )}

      {selections.length > 0 && (
        <ul className="graph-list">
          {selections.map((s, i) => (
            <li key={s.id} className="graph-list-item">
              <span className="graph-list-index">{i + 1}</span>
              {paired ? (
                <span className="graph-list-label">
                  <span className="source-swatch nipun" /> {s.nipun.label}
                  <span className="graph-pair-arrow"> ↔ </span>
                  <span className="source-swatch partner" /> {s.partner.label}
                </span>
              ) : (
                <span className="graph-list-label">
                  <span className={`source-swatch ${s.source}`} /> {s.ref.label}
                  <span className="graph-list-source"> ({s.source === 'nipun' ? 'NIPUN+' : 'Partner Org'})</span>
                </span>
              )}
              <span className="graph-list-actions">
                <button type="button" disabled={i === 0} onClick={() => move(s.id, -1)} title="Move up">
                  ▲
                </button>
                <button type="button" disabled={i === selections.length - 1} onClick={() => move(s.id, 1)} title="Move down">
                  ▼
                </button>
                <button type="button" onClick={() => removeAt(s.id)} title="Remove">
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">View</span>
          <div className="chip-row">
            {VIEW_MODES.map((v) => (
              <button key={v.key} type="button" className={`chip${viewMode === v.key ? ' active' : ''}`} onClick={() => setViewMode(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="graph-export-actions">
          <button type="button" className="chip" disabled={!chartRows.length} onClick={handleExportPng}>
            Download PNG
          </button>
          <button type="button" className="chip" disabled={!chartRows.length} onClick={handleExportCsv}>
            Download CSV
          </button>
        </div>
      </div>

      {status === 'loading' && <p className="compare-empty">Fetching Partner Org numbers…</p>}
      {status === 'error' && (
        <p className="compare-empty" style={{ color: 'var(--critical)' }}>
          Couldn't build the graph: {error}
        </p>
      )}
      {(status === 'ready' || status === 'idle') && (
        <GraphChart ref={chartRef} mode={paired ? 'paired' : 'unpaired'} viewMode={viewMode} rows={chartRows} totalsText={totalsText} />
      )}
    </div>
  )
}
