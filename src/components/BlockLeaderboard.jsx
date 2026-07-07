import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtNum, fmtInt, fmtSigned } from '../lib/format'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.block}</div>
      <div>Avg: <strong>{fmtNum(d.overall)}</strong></div>
      <div style={{ color: 'var(--text-muted)' }}>{fmtInt(d.n)} schools assessed</div>
    </div>
  )
}

export default function BlockLeaderboard({ data }) {
  const sorted = [...data].filter((d) => d.overall !== null).sort((a, b) => b.overall - a.overall)
  const height = Math.max(240, sorted.length * 28)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }} barSize={16}>
        <CartesianGrid stroke="var(--gridline)" horizontal={false} />
        <XAxis type="number" hide domain={[0, 'dataMax + 10']} />
        <YAxis
          type="category"
          dataKey="block"
          tick={{ fill: 'var(--text-primary)', fontSize: 12.5 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--page-plane)' }} />
        <Bar dataKey="overall" radius={[0, 4, 4, 0]}>
          {sorted.map((entry, i) => (
            <Cell key={entry.block} fill={i < 3 ? 'var(--good)' : i >= sorted.length - 3 ? 'var(--critical)' : 'var(--series-1)'} />
          ))}
          <LabelList
            dataKey="overall"
            position="right"
            formatter={(v) => fmtNum(v)}
            style={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
