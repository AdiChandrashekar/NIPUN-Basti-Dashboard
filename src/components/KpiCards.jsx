import { fmtNum, fmtInt, fmtSigned } from '../lib/format'

export default function KpiCards({ districtAvgByMonth, latestMonth, topBlock }) {
  const cur = districtAvgByMonth[districtAvgByMonth.length - 1]
  const prev = districtAvgByMonth[districtAvgByMonth.length - 2]
  const change = cur && prev ? cur.avg - prev.avg : null

  const tiles = [
    {
      label: `District Avg (${cur?.label ?? '—'})`,
      value: fmtNum(cur?.avg),
      delta: change !== null ? `${fmtSigned(change)} pp vs ${prev?.label}` : null,
      dir: change === null ? null : change >= 0 ? 'up' : 'down',
    },
    {
      label: 'Schools Assessed',
      value: fmtInt(latestMonth?.n),
      delta: `${latestMonth?.blockCount ?? '—'} blocks`,
      dir: null,
    },
    {
      label: 'Top Block (latest)',
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
