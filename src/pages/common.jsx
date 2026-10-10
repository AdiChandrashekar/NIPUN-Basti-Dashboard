import { Notice } from '../components/ui.jsx'
import { int } from '../lib/data.js'

export function PageHead({ crumb, title, children }) {
  return (
    <div className="page-head">
      <div className="crumbs">{crumb}</div>
      <h1>{title}</h1>
      {children && <div className="page-meta">{children}</div>}
    </div>
  )
}

export function filterSummary(data, f) {
  const parts = []
  if (f.block) parts.push(f.block)
  if (f.grade) parts.push(`Grade ${f.grade}`)
  if (f.subject) parts.push(f.subject)
  if (f.lo) parts.push(data.losByCode[f.lo]?.label || f.lo)
  if (f.area) parts.push(f.area === 'R' ? 'Rural' : 'Urban')
  return parts
}

export function MonthPills({ data, f }) {
  const month = data.months.find((m) => m.key === f.m)
  return (
    <>
      <span className="pill">{month.label}</span>
      {filterSummary(data, f).map((p) => (
        <span key={p} className="pill pill-filter">
          {p}
        </span>
      ))}
      <span className="pill pill-muted">{month.format === 'count' ? 'Student counts per LO' : 'School percentages'}</span>
    </>
  )
}

export function MonthNotices({ data, monthKey }) {
  const month = data.months.find((m) => m.key === monthKey)
  const maxN = Math.max(...data.months.map((m) => m.schools))
  return (
    <>
      {month.lowCoverage && (
        <Notice tone="warning">
          <strong>Few schools in {month.label}:</strong> {int(month.schools)} schools reported, against {int(maxN)} in the busiest month. Treat {month.label} as
          indicative, not as a district-wide trend.
        </Notice>
      )}
    </>
  )
}

// The first month in the student-count format, for the "new format" marker on trend charts.
export function formatBreak(data) {
  const i = data.months.findIndex((m) => m.format === 'count')
  return i > 0 ? { key: data.months[i].key, label: 'New LO format' } : null
}

export const monthXs = (data) => data.months.map((m) => ({ key: m.key, label: m.label.split(' ')[0] }))
