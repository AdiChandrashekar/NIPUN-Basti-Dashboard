import { useMemo, useState } from 'react'
import { fmtNum, fmtPct, fmtSigned } from '../lib/format'

const COLUMNS = [
  { key: 'code', label: 'Competency' },
  { key: 'grade', label: 'Grade' },
  { key: 'subject', label: 'Subject' },
  { key: 'avg', label: 'Avg', num: true },
  { key: 'delta', label: 'Chg (pp)', num: true },
  { key: 'zeroPct', label: '0-scorers', num: true },
  { key: 'bandHigh', label: '>75%', num: true },
]

export default function CompetencyTable({ perComp, deltas }) {
  const [sortKey, setSortKey] = useState('avg')
  const [sortDir, setSortDir] = useState(-1)

  const merged = useMemo(
    () =>
      perComp.map((c) => ({
        ...c,
        delta: deltas?.find((d) => d.code === c.code)?.chg ?? null,
      })),
    [perComp, deltas]
  )

  const sorted = useMemo(() => {
    const arr = [...merged]
    arr.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'string') return sortDir * av.localeCompare(bv)
      return sortDir * (av - bv)
    })
    return arr
  }, [merged, sortKey, sortDir])

  function onSort(key) {
    if (key === sortKey) setSortDir((d) => -d)
    else {
      setSortKey(key)
      setSortDir(-1)
    }
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={c.num ? 'num' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={() => onSort(c.key)}
              >
                {c.label}
                {sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.code}>
              <td>
                <div style={{ fontWeight: 600 }}>{c.code}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.desc}</div>
              </td>
              <td>{c.grade}</td>
              <td>
                <span className={`pill ${c.subject.toLowerCase()}`}>{c.subject}</span>
              </td>
              <td className="num">{fmtNum(c.avg)}</td>
              <td
                className="num"
                style={{ color: c.delta === null ? undefined : c.delta >= 0 ? 'var(--success-text)' : 'var(--critical)' }}
              >
                {c.delta === null ? '—' : fmtSigned(c.delta)}
              </td>
              <td className="num">{fmtPct(c.zeroPct)}</td>
              <td className="num">{fmtPct(c.bandHigh)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
