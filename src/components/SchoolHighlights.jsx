import { fmtNum, fmtSigned } from '../lib/format'

function MiniTable({ title, rows, renderValue }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>{title}</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>School</th>
              <th className="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.block}</td>
                <td>{r.school}</td>
                <td className="num">{renderValue(r)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: 'var(--text-muted)' }}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SchoolHighlights({ zeroLeaders, improvers, decliners }) {
  return (
    <div className="highlights-grid">
      <MiniTable title="Most zero-scores (latest month)" rows={zeroLeaders} renderValue={(r) => `${r.zeroCount}/23`} />
      <MiniTable
        title="Most improved (vs previous month)"
        rows={improvers}
        renderValue={(r) => <span style={{ color: 'var(--success-text)' }}>{fmtSigned(r.change)}</span>}
      />
      <MiniTable
        title="Sharpest decline (vs previous month)"
        rows={decliners}
        renderValue={(r) => <span style={{ color: 'var(--critical)' }}>{fmtSigned(r.change)}</span>}
      />
    </div>
  )
}
