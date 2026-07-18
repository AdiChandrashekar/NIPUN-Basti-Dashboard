import { useMemo, useState } from 'react'
import CompetencyStepFilter from './CompetencyStepFilter'
import { computeScopeBreakdown } from '../../lib/analysis'
import { fmtNum, fmtInt } from '../../lib/format'

const SCOPES = [
  { key: 'district', label: 'District' },
  { key: 'block', label: 'Block' },
  { key: 'school', label: 'School' },
]

export default function NipunPanel({ base }) {
  const competencies = useMemo(
    () => base.meta.map((c) => ({ code: c.Code, label: c.Desc, grade: c.Grade, subject: c.Subject })),
    [base.meta]
  )
  const grades = useMemo(() => [...new Set(competencies.map((c) => c.grade))].sort(), [competencies])

  const [month, setMonth] = useState(base.months[base.months.length - 1]?.key ?? '')
  const [scope, setScope] = useState('district')
  const [grade, setGrade] = useState(grades[0] ?? '')
  const [subject, setSubject] = useState('Literacy')
  const [selectedCodes, setSelectedCodes] = useState([])

  const filteredMeta = useMemo(
    () => base.meta.filter((c) => selectedCodes.includes(c.Code)),
    [base.meta, selectedCodes]
  )

  const table = useMemo(() => {
    if (!filteredMeta.length || !month) return []
    return computeScopeBreakdown(base.rows, filteredMeta, month, scope)
  }, [base.rows, filteredMeta, month, scope])

  return (
    <div className="compare-panel">
      <h3>NIPUN Basti — Competency Dashboard</h3>
      <p className="panel-sub">Source: bundled monthly CSV snapshot</p>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="cmp-nipun-month">
            Month
          </label>
          <select id="cmp-nipun-month" className="month-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {base.months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Scope</span>
          <div className="chip-row">
            {SCOPES.map((s) => (
              <button key={s.key} type="button" className={`chip${scope === s.key ? ' active' : ''}`} onClick={() => setScope(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CompetencyStepFilter
        competencies={competencies}
        grade={grade}
        subject={subject}
        selectedCodes={selectedCodes}
        onGradeChange={setGrade}
        onSubjectChange={setSubject}
        onCodesChange={setSelectedCodes}
      />

      {filteredMeta.length === 0 ? (
        <p className="compare-empty">Pick Grade → Language → Competency above to build the table.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{scope === 'district' ? 'District' : scope === 'block' ? 'Block' : 'School'}</th>
                  <th className="num">Assessed</th>
                  {filteredMeta.map((c) => (
                    <th key={c.Code} className="num">
                      {c.Desc}
                    </th>
                  ))}
                  <th className="num">Overall Avg %</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr key={`${row.key}-${i}`}>
                    <td>{row.label}</td>
                    <td className="num">{fmtInt(row.n)}</td>
                    {row.perComp.map((c) => (
                      <td key={c.code} className="num">
                        {fmtNum(c.avg)}
                      </td>
                    ))}
                    <td className="num" style={{ fontWeight: 600 }}>
                      {fmtNum(row.overall)}
                    </td>
                  </tr>
                ))}
                {table.length === 0 && (
                  <tr>
                    <td colSpan={filteredMeta.length + 3} style={{ color: 'var(--text-muted)' }}>
                      No rows for this scope/month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="compare-note">
            "Overall Avg %" is the mean of the competencies selected above — a pre-aggregated pass percentage, not a
            NIPUN-status ratio.
          </p>
        </>
      )}
    </div>
  )
}
