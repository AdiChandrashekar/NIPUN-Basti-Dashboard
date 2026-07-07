export default function CoverageBanner({ month }) {
  if (!month || !month.isLowCoverage) return null
  const pct = Math.round((month.n / month.maxN) * 100)
  return (
    <div className="banner" role="status">
      <span aria-hidden="true">⚠️</span>
      <div>
        <strong>{month.label} data is partial ({month.n} schools, {pct}% of the largest month).</strong>{' '}
        Figures for {month.label} are shown for visibility but should be treated as directional, not
        authoritative, until coverage is closer to the other months — especially block-level rankings,
        which swing a lot on small samples.
      </div>
    </div>
  )
}
