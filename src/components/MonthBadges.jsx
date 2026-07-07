export default function MonthBadges({ months }) {
  return (
    <div className="month-badges">
      {months.map((m) => (
        <span key={m.key} className={`month-badge${m.isLowCoverage ? ' low-coverage' : ''}`}>
          {m.label}: {m.n.toLocaleString()} schools{m.isLowCoverage ? ' (partial)' : ''}
        </span>
      ))}
    </div>
  )
}
