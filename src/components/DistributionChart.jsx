import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtPct } from '../lib/format'

const BANDS = [
  { key: 'bandZero', label: '0%', color: 'var(--critical)' },
  { key: 'bandLow', label: '1–49%', color: 'var(--serious)' },
  { key: 'bandMid', label: '50–75%', color: 'var(--warning)' },
  { key: 'bandHigh', label: '>75%', color: 'var(--good)' },
]

function mean(arr) {
  const v = arr.filter((x) => x !== null && x !== undefined)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload
        .slice()
        .reverse()
        .map((p) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {BANDS.find((b) => b.key === p.dataKey)?.label}: {fmtPct(p.value)}
          </div>
        ))}
    </div>
  )
}

export default function DistributionChart({ byMonth, months }) {
  const data = months.map((m) => {
    const perComp = byMonth[m.key].perComp
    return {
      label: m.label,
      bandZero: mean(perComp.map((c) => c.bandZero)),
      bandLow: mean(perComp.map((c) => c.bandLow)),
      bandMid: mean(perComp.map((c) => c.bandMid)),
      bandHigh: mean(perComp.map((c) => c.bandHigh)),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }} barSize={28}>
        <CartesianGrid stroke="var(--gridline)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--baseline)' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: 'var(--text-primary)', fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--page-plane)' }} />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
        />
        {BANDS.map((b) => (
          <Bar key={b.key} dataKey={b.key} stackId="a" fill={b.color} name={b.label} radius={[0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
