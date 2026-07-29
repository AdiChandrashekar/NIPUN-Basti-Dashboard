import { forwardRef } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Literal hex, not var(--x): the chart's <svg> gets cloned into a detached
// document for PNG export (exportPng.js), which has no access to this page's
// CSS custom properties. Mirrors theme.css — keep in sync if it changes.
const NIPUN_COLOR = '#1a3a5c' // --navy
const PARTNER_COLOR = '#d97e1f' // --saffron
const BAND_COLOR = { bandZero: '#c62828', bandLow: '#ef6c5a', bandMid: '#f5a623', bandHigh: '#2d7a4a' }
const BAND_LABEL = { bandZero: '0%', bandLow: '1–49%', bandMid: '50–75%', bandHigh: '>75%' }
const BAND_KEYS = ['bandZero', 'bandLow', 'bandMid', 'bandHigh']

function pctTick(v) {
  return `${Math.round(v * 100)}%`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {pctTick(p.value)}
        </div>
      ))}
    </div>
  )
}

// rows: for mode='unpaired', resolved entries [{id,source,label,bandZero..bandHigh}].
// for mode='paired', pairs [{id, nipun: entry, partner: entry}].
const GraphChart = forwardRef(function GraphChart({ mode, viewMode, rows }, ref) {
  if (!rows.length) {
    return (
      <div className="compare-empty" ref={ref}>
        Add at least one competency above to build the chart.
      </div>
    )
  }

  const height = Math.max(220, rows.length * (mode === 'paired' ? 60 : 40))

  let chartData, series
  if (mode === 'paired') {
    chartData = rows.map((p, i) => {
      const row = { name: `${i + 1}. ${p.nipun.label} ↔ ${p.partner.label}` }
      if (viewMode === 'achievement') {
        row.nipun_bandHigh = p.nipun.bandHigh
        row.partner_bandHigh = p.partner.bandHigh
      } else {
        BAND_KEYS.forEach((k) => {
          row[`nipun_${k}`] = p.nipun[k]
          row[`partner_${k}`] = p.partner[k]
        })
      }
      return row
    })
    series =
      viewMode === 'achievement'
        ? [
            { dataKey: 'nipun_bandHigh', name: 'NIPUN+', fill: NIPUN_COLOR },
            { dataKey: 'partner_bandHigh', name: 'Partner Org', fill: PARTNER_COLOR },
          ]
        : [
            ...BAND_KEYS.map((k) => ({ dataKey: `nipun_${k}`, name: `NIPUN+ ${BAND_LABEL[k]}`, fill: BAND_COLOR[k], stackId: 'nipun' })),
            ...BAND_KEYS.map((k) => ({ dataKey: `partner_${k}`, name: `Partner Org ${BAND_LABEL[k]}`, fill: BAND_COLOR[k], stackId: 'partner' })),
          ]
  } else {
    chartData = rows.map((r) => {
      const row = { name: r.label, source: r.source }
      if (viewMode === 'achievement') row.bandHigh = r.bandHigh
      else BAND_KEYS.forEach((k) => (row[k] = r[k]))
      return row
    })
    series =
      viewMode === 'achievement'
        ? [{ dataKey: 'bandHigh', name: '% Achieved' }]
        : BAND_KEYS.map((k) => ({ dataKey: k, name: BAND_LABEL[k], fill: BAND_COLOR[k], stackId: 'a' }))
  }

  return (
    <div ref={ref}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }} barCategoryGap={mode === 'paired' ? '30%' : '20%'}>
          <CartesianGrid stroke="var(--gridline)" horizontal={false} />
          <XAxis type="number" domain={[0, 1]} tickFormatter={pctTick} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--baseline)' }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={220} tick={{ fill: 'var(--text-primary)', fontSize: 11.5 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--page-plane)' }} />
          <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>} />
          {series.map((s) =>
            mode === 'unpaired' && viewMode === 'achievement' ? (
              <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} radius={[0, 4, 4, 0]}>
                {chartData.map((row, i) => (
                  <Cell key={i} fill={row.source === 'nipun' ? NIPUN_COLOR : PARTNER_COLOR} />
                ))}
              </Bar>
            ) : (
              <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.fill} stackId={s.stackId} radius={mode === 'unpaired' ? undefined : [0, 4, 4, 0]} />
            )
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})

export default GraphChart
