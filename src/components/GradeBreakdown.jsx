import { fmtNum } from '../lib/format'

export default function GradeBreakdown({ groups }) {
  return (
    <div className="grade-card-grid">
      {groups.map((g) => (
        <div className="grade-card" key={`${g.grade}-${g.subject}`}>
          <h3>
            {g.grade} · <span className={`pill ${g.subject.toLowerCase()}`}>{g.subject}</span>
          </h3>
          <div className="row">
            <span className="label">Best — {g.best.code}</span>
            <span>{fmtNum(g.best.avg)}</span>
          </div>
          <div className="row">
            <span className="label">Weakest — {g.worst.code}</span>
            <span>{fmtNum(g.worst.avg)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
