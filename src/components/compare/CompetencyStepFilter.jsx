import MultiSelect from '../MultiSelect'

const SUBJECTS = ['Literacy', 'Numeracy']

// Stepwise Grade -> Language -> Competency filter. Controlled component:
// takes the normalized {code,label,grade,subject}[] pool plus the current
// selection, and reports changes back up — used identically by both the
// NIPUN (CSV) and SSP (API) panels even though their competency pools come
// from different sources.
export default function CompetencyStepFilter({
  competencies,
  grade,
  subject,
  selectedCodes,
  onGradeChange,
  onSubjectChange,
  onCodesChange,
  gradeLabel = (g) => g,
}) {
  const grades = [...new Set(competencies.map((c) => c.grade))].sort()
  const scoped = competencies.filter((c) => c.grade === grade && c.subject === subject)

  function handleGradeChange(g) {
    onGradeChange(g)
    onCodesChange([])
  }
  function handleSubjectChange(s) {
    onSubjectChange(s)
    onCodesChange([])
  }

  return (
    <div className="step-filter">
      <div className="filter-group">
        <span className="filter-label">Grade</span>
        <div className="chip-row">
          {grades.map((g) => (
            <button key={g} type="button" className={`chip${grade === g ? ' active' : ''}`} onClick={() => handleGradeChange(g)}>
              {gradeLabel(g)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">Language</span>
        <div className="chip-row">
          {SUBJECTS.map((s) => (
            <button key={s} type="button" className={`chip${subject === s ? ' active' : ''}`} onClick={() => handleSubjectChange(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <MultiSelect
        label="Competency"
        allLabel="None selected"
        searchable
        options={scoped.map((c) => ({ value: c.code, label: c.label }))}
        selected={selectedCodes}
        onChange={onCodesChange}
      />
    </div>
  )
}
