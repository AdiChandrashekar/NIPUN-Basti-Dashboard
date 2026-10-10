import { useMemo } from 'react'
import { Heatmap, LineChart } from '../components/charts.jsx'
import { ChartCard, StatCard } from '../components/ui.jsx'
import { filterResults, int, pct, scoreStatus, summarize } from '../lib/data.js'
import { PageHead, formatBreak, monthXs } from './common.jsx'

export default function SchoolDetail({ data, filters: f, udise, nav }) {
  const school = data.schools.find((s) => s.udise === udise)
  const byMonth = useMemo(() => {
    const out = {}
    for (const m of data.months) out[m.key] = filterResults(data.results[m.key], { ...f, block: '', lo: '' }).filter((r) => r.school.udise === udise)
    return out
  }, [data, udise, f.grade, f.subject])

  if (!school) return <div className="empty card">No school with UDISE {udise}.</div>

  const xs = monthXs(data)
  const reported = data.months.filter((m) => byMonth[m.key].length)
  const last = reported[reported.length - 1]
  const lastSum = last ? summarize(byMonth[last.key]) : null
  const series = data.months.map((m) => (byMonth[m.key].length ? summarize(byMonth[m.key]).avg : null))
  const blockSeries = data.months.map((m) => summarize(filterResults(data.results[m.key], { ...f, block: school.block, lo: '' })).avg)
  const codes = data.los.filter((l) => data.months.some((m) => byMonth[m.key].some((r) => r.code === l.code)))
  const cell = (code, mk) => byMonth[mk].find((r) => r.code === code)

  return (
    <>
      <PageHead crumb={<a href="#/schools" onClick={(e) => (e.preventDefault(), nav('schools'))}>← Schools</a>} title={school.name}>
        <span className="pill">{school.block}</span>
        <span className="pill pill-muted">UDISE {school.udise}</span>
        <span className="pill pill-muted">{school.area === 'U' ? 'Urban' : 'Rural'}</span>
      </PageHead>

      <div className="stats">
        <StatCard label="Months reported" value={`${reported.length} of ${data.months.length}`} sub={reported.map((m) => m.label.split(' ')[0]).join(', ') || 'None'} />
        <StatCard label={`Average · ${last?.label || '—'}`} value={pct(lastSum?.avg)} status={scoreStatus(lastSum?.avg)} sub={`${lastSum?.n || 0} learning outcomes`} />
        <StatCard label="Children assessed" value={int(lastSum?.students)} sub={last?.format === 'count' ? `in ${last.label}` : 'Counts start Jul 2026'} />
      </div>

      <div className="grid-2">
        <ChartCard title="Average result by month" sub={`This school against the ${school.block} block average`}>
          <LineChart
            xs={xs}
            series={[
              { key: 's', label: 'This school', short: 'School', values: series, color: '#2a78d6' },
              { key: 'b', label: `${school.block} block`, short: 'Block', values: blockSeries, color: '#7b8594', dash: true },
            ]}
            marker={formatBreak(data)}
            label="School and block average result by month"
          />
        </ChartCard>
        <ChartCard title="Every learning outcome" sub="School result by month · hover for children achieved / assessed">
          {codes.length === 0 ? (
            <div className="empty">No results under these filters.</div>
          ) : (
            <div className="matrix-wrap">
              <Heatmap
                rows={codes.map((l) => ({ key: l.code, label: l.desc ? `${l.code} ${l.desc}` : l.code, title: l.label, group: `Grade ${l.grade} · ${l.subject}` }))}
                cols={data.months.map((m, i) => ({ key: m.key, label: xs[i].label }))}
                cell={(code, mk) => {
                  const r = cell(code, mk)
                  if (!r) return { value: null, text: '·', tip: 'Not assessed' }
                  return { value: r.pct, text: `${Math.round(r.pct)}`, tip: r.n != null ? `${r.a} of ${r.n} children achieved (${pct(r.pct)})` : pct(r.pct) }
                }}
                legend={{ label: 'School result' }}
              />
            </div>
          )}
        </ChartCard>
      </div>
    </>
  )
}
