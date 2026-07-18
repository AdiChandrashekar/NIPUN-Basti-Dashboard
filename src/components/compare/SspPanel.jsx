import { useEffect, useMemo, useState } from 'react'
import CompetencyStepFilter from './CompetencyStepFilter'
import { fetchSsp } from '../../lib/sspApi'
import { computeSspTable, datasetForLevel } from '../../lib/sspAnalysis'
import { SSP_COMPETENCIES, SSP_QUARTERS } from '../../lib/sspTaxonomy'
import { fmtNum, fmtInt } from '../../lib/format'

const SCOPES = [
  { key: 'district', label: 'District' },
  { key: 'block', label: 'Block' },
  { key: 'school', label: 'School' },
]

export default function SspPanel() {
  const [quarter, setQuarter] = useState(SSP_QUARTERS[0].key)
  const [scope, setScope] = useState('district')
  const [grade, setGrade] = useState('1')
  const [subject, setSubject] = useState('Literacy')
  const [selectedCodes, setSelectedCodes] = useState([])

  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)
  const [apiRows, setApiRows] = useState([])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)
    fetchSsp(datasetForLevel(scope), { quarter, grade })
      .then((data) => {
        if (cancelled) return
        setApiRows(data)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [quarter, scope, grade])

  // Codes like 'letterId' or 'numberId' are reused across grades in the SSP
  // taxonomy, so selection must be re-scoped to the current grade to avoid
  // pulling in a same-named field from a different grade.
  const selectedCompetencies = useMemo(
    () => SSP_COMPETENCIES.filter((c) => selectedCodes.includes(c.code) && c.grade === grade),
    [selectedCodes, grade]
  )

  const table = useMemo(() => {
    if (status !== 'ready' || !selectedCompetencies.length) return []
    return computeSspTable(scope, apiRows, selectedCompetencies)
  }, [status, apiRows, scope, selectedCompetencies])

  return (
    <div className="compare-panel">
      <h3>SSP Dashboard</h3>
      <p className="panel-sub">Source: live Apps Script backend (student-level NIPUN proficiency)</p>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="cmp-ssp-quarter">
            Quarter
          </label>
          <select id="cmp-ssp-quarter" className="month-select" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
            {SSP_QUARTERS.map((q) => (
              <option key={q.key} value={q.key}>
                {q.label}
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
        competencies={SSP_COMPETENCIES}
        grade={grade}
        subject={subject}
        selectedCodes={selectedCodes}
        onGradeChange={setGrade}
        onSubjectChange={setSubject}
        onCodesChange={setSelectedCodes}
        gradeLabel={(g) => `Grade ${g}`}
      />

      {status === 'loading' && <p className="compare-empty">Loading from the SSP backend…</p>}

      {status === 'error' && (
        <p className="compare-empty" style={{ color: 'var(--critical)' }}>
          Couldn't reach the SSP backend: {error}
        </p>
      )}

      {status === 'ready' && selectedCompetencies.length === 0 && (
        <p className="compare-empty">Pick Grade → Language → Competency above to build the table.</p>
      )}

      {status === 'ready' && selectedCompetencies.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{scope === 'district' ? 'District' : scope === 'block' ? 'Block' : 'School'}</th>
                  <th className="num">Assessed</th>
                  {selectedCompetencies.map((c) => (
                    <th key={c.code} className="num">
                      {c.label}
                    </th>
                  ))}
                  <th className="num">NIPUN %</th>
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
                      {fmtNum(row.nipunPct)}
                    </td>
                  </tr>
                ))}
                {table.length === 0 && (
                  <tr>
                    <td colSpan={selectedCompetencies.length + 3} style={{ color: 'var(--text-muted)' }}>
                      No rows for this scope/quarter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="compare-note">
            "NIPUN %" is the true share of assessed students meeting NIPUN proficiency (both Literacy and Numeracy ≥
            75%) for this scope.
          </p>
        </>
      )}
    </div>
  )
}
