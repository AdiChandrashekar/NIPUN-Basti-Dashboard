import { fmtNum, fmtInt, fmtSigned } from '../lib/format'

export default function KpiCards({ districtAvgByMonth, selectedMonthKey, monthInfo, topBlock }) {
  const idx = districtAvgByMonth.findIndex((m) => m.key === selectedMonthKey)
  const cur = idx === -1 ? districtAvgByMonth[districtAvgByMonth.length - 1] : districtAvgByMonth[idx]
  const prev = idx > 0 ? districtAvgByMonth[idx - 1] : null
  const change = cur && prev ? cur.avg - prev.avg : null

  const tiles = [
    {
      label: `District Avg (${cur?.label ?? '—'})`,
      value: fmtNum(cur?.avg),
      delta: change !== null ? `${fmtSigned(change)} pp vs ${prev?.label}` : 'No prior month to compare',
      dir: change === null ? null : change >= 0 ? 'up' : 'down',
    },
    {
      label: 'Schools Assessed',
      value: fmtInt(monthInfo?.n),
      delta: `${monthInfo?.blockCount ?? '—'} blocks`,
      dir: null,
    },
    {
      label: `Top Block (${cur?.label ?? '—'})`,
      value: topBlock?.block ?? '—',
      delta: topBlock ? `avg ${fmtNum(topBlock.overall)}` : null,
      dir: null,
    },
    {
      label: 'Months Tracked',
      value: districtAvgByMonth.length,
      delta: districtAvgByMonth.map((m) => m.label).join(' → '),
      dir: null,
    },
  ]

  return (
    <div className="kpi-row">
      {tiles.map((t) => (
        <div className="kpi-tile" key={t.label}>
          <div className="kpi-label">{t.label}</div>
          <div className="kpi-value">{t.value}</div>
          {t.delta && <div className={`kpi-delta${t.dir ? ' ' + t.dir : ''}`}>{t.delta}</div>}
        </div>
      ))}
    </div>
  )
}
