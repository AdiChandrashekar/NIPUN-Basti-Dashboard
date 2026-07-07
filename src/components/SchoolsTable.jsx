import { useMemo, useState } from 'react'
import { fmtNum, fmtSigned } from '../lib/format'

const PAGE_SIZE = 25

const COLUMNS = [
  { key: 'school', label: 'School' },
  { key: 'block', label: 'Block' },
  { key: 'total', label: 'Assessed', num: true },
  { key: 'avg', label: 'Avg (filtered)', num: true },
  { key: 'change', label: 'Chg vs prev', num: true },
  { key: 'zeroCount', label: '0-scores', num: true },
]

export default function SchoolsTable({ data, prevMonthLabel, compCount }) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('avg')
  const [sortDir, setSortDir] = useState(-1)
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!query) return data
    const q = query.toLowerCase()
    return data.filter((r) => r.school?.toLowerCase().includes(q) || r.block?.toLowerCase().includes(q))
  }, [data, query])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'string') return sortDir * av.localeCompare(bv)
      return sortDir * (av - bv)
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageRows = sorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  function onSort(key) {
    if (key === sortKey) setSortDir((d) => -d)
    else {
      setSortKey(key)
      setSortDir(key === 'school' || key === 'block' ? 1 : -1)
    }
    setPage(0)
  }

  return (
    <div>
      <input
        className="search-input"
        placeholder="Search school or block…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setPage(0)
        }}
      />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : undefined} style={{ cursor: 'pointer' }} onClick={() => onSort(c.key)}>
                  {c.label}
                  {sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.schoolCode}>
                <td>{r.school}</td>
                <td>{r.block}</td>
                <td className="num">{r.total ?? '—'}</td>
                <td className="num">{fmtNum(r.avg)}</td>
                <td className="num" style={{ color: r.change === null ? undefined : r.change >= 0 ? 'var(--success-text)' : 'var(--critical)' }}>
                  {r.change === null ? '—' : fmtSigned(r.change)}
                </td>
                <td className="num">
                  {r.zeroCount}/{compCount}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ color: 'var(--text-muted)' }}>
                  No schools match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          {sorted.length.toLocaleString()} schools{prevMonthLabel ? ` · change vs ${prevMonthLabel}` : ''}
        </span>
        <button disabled={clampedPage === 0} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <span>
          Page {clampedPage + 1} / {totalPages}
        </span>
        <button disabled={clampedPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
