import { forwardRef } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Literal hex, not var(--x): the chart's <svg> gets cloned into a detached
// document for PNG export (exportPng.js), which has no access to this page's
// CSS custom properties. Mirrors theme.css — keep in sync if it changes.
const NIPUN_COLOR = '#1a3a5c' // --navy
const PARTNER_COLOR = '#d97e1f' // --saffron
const BAND_COLOR = { bandZero: '#c62828', bandLow: '#ef6c5a', bandMid: '#f5a623', bandHigh: '#2d7a4a' }
const BAND_LABEL = { bandZero: '0%', bandLow: '1–49%', bandMid: '50–75%', bandHigh: '>75%' }
const BAND_KEYS = ['bandZero', 'bandLow', 'bandMid', 'bandHigh']
const GRID_COLOR = '#e6e0d4' // --gridline
const AXIS_LINE_COLOR = '#c9bfa9' // --baseline
const AXIS_TEXT_COLOR = '#8a8a8a' // --text-muted
const CATEGORY_TEXT_COLOR = '#1a1a1a' // --text-primary
const LEGEND_TEXT_COLOR = '#5a5a5a' // --text-secondary

function pctTick(v) {
  return `${Math.round(v * 100)}%`
}

// Perceived-luminance contrast: dark fills get white text, light fills get near-black.
function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff'
}

// Below ~2% the bar is too narrow for legible text (domain is fixed 0-1, so
// value is a reliable proxy for rendered width without needing a pixel measurement).
function pctLabel(v) {
  return v && v > 0.02 ? `${Math.round(v * 100)}%` : ''
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
// totalsText: e.g. "NIPUN+: 127 schools · Partner Org: 3,842 students" — rendered
// bottom-right, inside the SVG so it survives PNG export.
const GraphChart = forwardRef(function GraphChart({ mode, viewMode, rows, totalsText }, ref) {
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
            ...BAND_KEYS.map((k) => ({ dataKey: `nipun_${k}`, name: `NIPUN+ ${BAND_LABEL[k]}`, fill: BAND_COLOR[k], stackId: 'nipun', stroke: NIPUN_COLOR })),
            ...BAND_KEYS.map((k) => ({ dataKey: `partner_${k}`, name: `Partner Org ${BAND_LABEL[k]}`, fill: BAND_COLOR[k], stackId: 'partner', stroke: PARTNER_COLOR })),
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

  const rowSourceColor = (i) => (chartData[i].source === 'nipun' ? NIPUN_COLOR : PARTNER_COLOR)

  return (
    <div ref={ref} className="graph-chart-wrap">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }} barCategoryGap={mode === 'paired' ? '30%' : '20%'}>
          <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
          <XAxis type="number" domain={[0, 1]} tickFormatter={pctTick} tick={{ fill: AXIS_TEXT_COLOR, fontSize: 12 }} axisLine={{ stroke: AXIS_LINE_COLOR }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={220} tick={{ fill: CATEGORY_TEXT_COLOR, fontSize: 11.5 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--page-plane)' }} />
          <Legend formatter={(value) => <span style={{ color: LEGEND_TEXT_COLOR, fontSize: 12 }}>{value}</span>} />
          {series.map((s) => {
            // Achievement bars are always navy or saffron, both dark enough for white
            // text; distribution segments vary by tier, so contrast is computed per series.
            const labelStyle = { fontSize: 10.5, fontWeight: 700, fill: viewMode === 'achievement' ? '#ffffff' : contrastColor(s.fill) }

            if (mode === 'unpaired' && viewMode === 'achievement') {
              return (
                <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {chartData.map((row, i) => (
                    <Cell key={i} fill={rowSourceColor(i)} />
                  ))}
                  <LabelList dataKey={s.dataKey} position="center" formatter={pctLabel} style={labelStyle} />
                </Bar>
              )
            }
            if (mode === 'unpaired') {
              // Distribution + unpaired: fill = band tier (uniform per series), but the
              // outline is colored per-row by source so you can still tell NIPUN+ rows
              // from Partner Org rows apart even though the fill no longer encodes it.
              return (
                <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.fill} stackId={s.stackId} strokeWidth={1.5} isAnimationActive={false}>
                  {chartData.map((row, i) => (
                    <Cell key={i} fill={s.fill} stroke={rowSourceColor(i)} />
                  ))}
                  <LabelList dataKey={s.dataKey} position="center" formatter={pctLabel} style={labelStyle} />
                </Bar>
              )
            }
            return (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                fill={s.fill}
                stackId={s.stackId}
                stroke={s.stroke}
                strokeWidth={s.stroke ? 1.5 : 0}
                radius={viewMode === 'achievement' ? [0, 4, 4, 0] : undefined}
                isAnimationActive={false}
              >
                <LabelList dataKey={s.dataKey} position="center" formatter={pctLabel} style={labelStyle} />
              </Bar>
            )
          })}
        </BarChart>
      </ResponsiveContainer>
      {totalsText && <div className="graph-totals">{totalsText}</div>}
    </div>
  )
})

export default GraphChart
