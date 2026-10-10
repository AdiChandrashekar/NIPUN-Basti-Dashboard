import { useMemo } from 'react'
import { BarList, Heatmap, LevelBar, LineChart } from '../components/charts.jsx'
import { ChartCard, DataTable, Section } from '../components/ui.jsx'
import { BANDS, blockRows, filterResults, int, loRows, monthSeries, pct, scoreStatus, share, signed, summarize } from '../lib/data.js'
import { MonthNotices, MonthPills, PageHead, formatBreak, monthXs } from './common.jsx'

export default function Competencies({ data, filters: f, setFilters, nav }) {
  const month = data.months.find((m) => m.key === f.m)
  const base = { ...f, lo: '' }

  const cells = useMemo(() => {
    const out = {}
    for (const m of data.months) {
      for (const r of filterResults(data.results[m.key], base)) {
        const k = `${r.code}|${m.key}`
        ;(out[k] ||= []).push(r)
      }
    }
    for (const k of Object.keys(out)) out[k] = summarize(out[k])
    return out
  }, [data, f.block, f.grade, f.subject, f.area])

  const los = data.los.filter((l) => data.months.some((m) => cells[`${l.code}|${m.key}`]))
  const rows = useMemo(() => loRows(data, f.m, base), [data, f.m, f.block, f.grade, f.subject, f.area])
  const sel = f.lo ? data.losByCode[f.lo] : null
  const xs = monthXs(data)

  return (
    <>
      <PageHead crumb="Learning outcomes" title={`Learning outcomes · ${month.label}`}>
        <MonthPills data={data} f={{ ...f, lo: '' }} />
      </PageHead>
      <MonthNotices data={data} monthKey={f.m} />

      <div className="grid-matrix">
        <ChartCard
          title="Every learning outcome, every month"
          sub="Average school result · grouped by grade and subject · click a row for details"
          className="matrix-card"
        >
          {los.length === 0 ? (
            <div className="empty">No learning outcomes match these filters.</div>
          ) : (
            <div className="matrix-wrap">
              <Heatmap
                rows={los.map((l) => ({ key: l.code, label: l.desc ? `${l.code} ${l.desc}` : l.code, title: l.label, group: `Grade ${l.grade} · ${l.subject}` }))}
                cols={data.months.map((m, i) => ({ key: m.key, label: xs[i].label }))}
                cell={(code, mk) => {
                  const s = cells[`${code}|${mk}`]
                  if (!s) return { value: null, text: '·', tip: 'Not assessed' }
                  return {
                    value: s.avg,
                    text: `${Math.round(s.avg)}`,
                    muted: s.schools < 5,
                    tip: `${data.losByCode[code].label}, ${data.months.find((m) => m.key === mk).label}: ${pct(s.avg)} · ${s.schools} schools${s.students != null ? `, ${int(s.students)} children` : ''}`,
                  }
                }}
                onRowClick={(lo) => setFilters({ lo: lo === f.lo ? '' : lo })}
                selectedRow={f.lo}
                legend={{ label: 'Average result', note: '· = not assessed; faded = fewer than 5 schools' }}
              />
            </div>
          )}
        </ChartCard>

        <div className="detail-card card">
          {sel ? <LoDetail data={data} f={f} lo={sel} nav={nav} onClose={() => setFilters({ lo: '' })} /> : <div className="empty">Select a learning outcome to see its trend, score spread and blocks.</div>}
        </div>
      </div>

      <Section title={`All learning outcomes · ${month.label}`} sub="Sortable · change is against the previous month with data">
        <DataTable
          csvName={`nipunplus-basti-learning-outcomes-${f.m}.csv`}
          rows={rows}
          initialSort={{ key: 'avg', dir: 'asc' }}
          searchText={(r) => `${r.code} ${r.lo.desc}`}
          onRowClick={(r) => setFilters({ lo: r.code })}
          columns={[
            { key: 'code', label: 'Code', value: (r) => r.code },
            { key: 'desc', label: 'Learning outcome', value: (r) => r.lo.desc || '—' },
            { key: 'grade', label: 'Grade', value: (r) => Number(r.lo.grade), align: 'right' },
            { key: 'subject', label: 'Subject', value: (r) => r.lo.subject },
            { key: 'schools', label: 'Schools', value: (r) => r.schools, align: 'right', render: (r) => int(r.schools) },
            { key: 'students', label: 'Children', value: (r) => r.students, align: 'right', render: (r) => int(r.students) },
            { key: 'avg', label: 'Average', value: (r) => r.avg, align: 'right', render: (r) => <ScoreCell v={r.avg} /> },
            { key: 'change', label: 'Change', value: (r) => r.change, align: 'right', render: (r) => <Delta v={r.change} />, csv: (r) => r.change?.toFixed(1) },
            {
              key: 'spread',
              label: 'Spread of school results',
              sortable: false,
              value: (r) => BANDS.map((b) => `${b.short}: ${r.bands[b.key]}`).join(' '),
              render: (r) => <LevelBar s={r.bands} levels={BANDS} />,
            },
            { key: 'zero', label: 'At 0%', value: (r) => r.bands.b0 / r.n, align: 'right', render: (r) => share(r.bands.b0, r.n) },
          ]}
        />
      </Section>
    </>
  )
}

function LoDetail({ data, f, lo, nav, onClose }) {
  const lf = { ...f, lo: lo.code }
  const series = monthSeries(data, lf)
  const cur = summarize(filterResults(data.results[f.m], lf))
  const blocks = blockRows(data, f.m, lf).sort((a, b) => b.avg - a.avg)
  return (
    <>
      <div className="detail-head">
        <div>
          <div className="crumbs">
            Grade {lo.grade} · {lo.subject}
          </div>
          <h2 className="detail-title">{lo.label}</h2>
        </div>
        <button className="btn btn-small" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </div>
      {cur.n ? (
        <p className="small">
          <strong>{pct(cur.avg)}</strong> average across <strong>{cur.schools} schools</strong> in {data.months.find((m) => m.key === f.m).label}
          {cur.students != null && (
            <>
              ; {pct(cur.studentPct)} of {int(cur.students)} children achieved it
            </>
          )}
          .
        </p>
      ) : (
        <p className="small muted">Not assessed in {data.months.find((m) => m.key === f.m).label} under these filters.</p>
      )}
      <LineChart xs={monthXs(data)} series={[{ key: 'lo', label: lo.code, short: '', values: series, color: '#2a78d6' }]} height={170} marker={formatBreak(data)} label={`${lo.label} average by month`} />
      {cur.n > 0 && (
        <>
          <div className="mini-title">Spread of school results</div>
          <LevelBar s={cur.bands} levels={BANDS} wide />
          <div className="legend small">
            {BANDS.map((b) => (
              <span key={b.key} className="legend-item">
                <span className="legend-swatch" style={{ background: b.color }} />
                {b.label}: {cur.bands[b.key]}
              </span>
            ))}
          </div>
          <div className="mini-title">Blocks</div>
          <BarList
            data={blocks.map((b) => ({ key: b.block, label: b.block, value: b.avg, status: scoreStatus(b.avg), sub: `${b.schools} sch.` }))}
            onSelect={(block) => nav('schools', null, { ...lf, block })}
          />
        </>
      )}
    </>
  )
}

export function ScoreCell({ v }) {
  if (v == null) return <span className="muted">—</span>
  return (
    <span className="meter-cell">
      <span className="meter" aria-hidden>
        <span className={`meter-fill meter-${{ good: 'good', warning: 'warning', critical: 'critical' }[scoreStatus(v)]}`} style={{ width: `${v}%` }} />
      </span>
      <span className="num-strong">{pct(v)}</span>
    </span>
  )
}

export function Delta({ v }) {
  if (v == null) return <span className="muted">—</span>
  return <span className={v > 0.05 ? 'delta-up' : v < -0.05 ? 'delta-down' : ''}>{signed(v)}</span>
}

