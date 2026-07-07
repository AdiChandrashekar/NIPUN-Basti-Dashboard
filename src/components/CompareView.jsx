import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import MultiSelect from './MultiSelect'
import { computeCompareSeries } from '../lib/analysis'
import { fmtNum } from '../lib/format'

const MAX_ITEMS = 8
const SERIES_COLORS = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmtNum(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function CompareView({ rows, meta, blocks, competencyMeta, selectedMonth, defaultBlocks, defaultCompetencies }) {
  const [dimension, setDimension] = useState('block')
  const [selectedBlocks, setSelectedBlocks] = useState(defaultBlocks)
  const [selectedComps, setSelectedComps] = useState(defaultCompetencies)

  const items = dimension === 'block' ? selectedBlocks : selectedComps
  const setItems = dimension === 'block' ? setSelectedBlocks : setSelectedComps
  const pool = dimension === 'block' ? blocks.map((b) => ({ value: b, label: b })) : competencyMeta.map((c) => ({ value: c.Code, label: `${c.Code} — ${c.Desc}` }))

  const compare = useMemo(() => computeCompareSeries(rows, meta, dimension, items), [rows, meta, dimension, items])

  const trendData = useMemo(() => {
    if (!compare.months.length) return []
    return compare.months.map((m) => {
      const point = { label: m.label }
      compare.series.forEach((s) => {
        const v = s.values.find((x) => x.monthKey === m.key)
        point[s.key] = v?.avg ?? null
      })
      return point
    })
  }, [compare])

  const snapshotData = useMemo(() => {
    return compare.series.map((s) => ({
      key: s.key,
      label: s.label,
      avg: s.values.find((v) => v.monthKey === selectedMonth)?.avg ?? null,
    }))
  }, [compare, selectedMonth])

  return (
    <section className="panel">
      <h2>Comparative performance</h2>
      <p className="panel-sub">Compare selected blocks or competencies across all tracked months</p>

      <div className="compare-controls">
        <div className="filter-group">
          <span className="filter-label">Compare by</span>
          <div className="chip-row">
            <button type="button" className={`chip${dimension === 'block' ? ' active' : ''}`} onClick={() => setDimension('block')}>
              Blocks
            </button>
            <button type="button" className={`chip${dimension === 'competency' ? ' active' : ''}`} onClick={() => setDimension('competency')}>
              Competencies
            </button>
          </div>
        </div>
        <MultiSelect
          label={dimension === 'block' ? 'Blocks to compare' : 'Competencies to compare'}
          allLabel="None selected"
          searchable
          maxSelected={MAX_ITEMS}
          options={pool}
          selected={items}
          onChange={setItems}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Up to {MAX_ITEMS} at a time</span>
      </div>

      {items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Pick at least one {dimension} above to compare.</p>
      ) : (
        <>
          <h3 style={{ fontSize: 13, margin: '4px 0 8px' }}>Trend across all months</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--baseline)' }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }} />
              <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>} />
              {compare.series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <h3 style={{ fontSize: 13, margin: '20px 0 8px' }}>Snapshot — selected month</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, items.length * 34)}>
            <BarChart data={snapshotData} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }} barSize={18}>
              <CartesianGrid stroke="var(--gridline)" horizontal={false} />
              <XAxis type="number" hide domain={[0, 'dataMax + 10']} />
              <YAxis type="category" dataKey="label" tick={{ fill: 'var(--text-primary)', fontSize: 12.5 }} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--page-plane)' }} />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                {snapshotData.map((d, i) => (
                  <Cell key={d.key} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  )
}
