import MultiSelect from './MultiSelect'

const GRADES = ['G1', 'G2', 'G3']
const SUBJECTS = ['Literacy', 'Numeracy']

export default function FilterBar({
  months,
  blocks,
  competencyMeta,
  filters,
  setFilters,
}) {
  const { month, blocks: selBlocks, grades: selGrades, subjects: selSubjects, competencies: selCompetencies } = filters

  function update(patch) {
    setFilters((f) => ({ ...f, ...patch }))
  }

  function toggleChip(key, value) {
    const cur = filters[key]
    update({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] })
  }

  const activeCount =
    selBlocks.length + selGrades.length + selSubjects.length + selCompetencies.length

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label className="filter-label" htmlFor="month-select">
          Month
        </label>
        <select id="month-select" className="month-select" value={month} onChange={(e) => update({ month: e.target.value })}>
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
              {m.isLowCoverage ? ' (partial)' : ''}
            </option>
          ))}
        </select>
      </div>

      <MultiSelect
        label="Block"
        allLabel="All blocks"
        searchable
        options={blocks.map((b) => ({ value: b, label: b }))}
        selected={selBlocks}
        onChange={(v) => update({ blocks: v })}
      />

      <div className="filter-group">
        <span className="filter-label">Grade</span>
        <div className="chip-row">
          {GRADES.map((g) => (
            <button key={g} type="button" className={`chip${selGrades.includes(g) ? ' active' : ''}`} onClick={() => toggleChip('grades', g)}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">Subject</span>
        <div className="chip-row">
          {SUBJECTS.map((s) => (
            <button key={s} type="button" className={`chip${selSubjects.includes(s) ? ' active' : ''}`} onClick={() => toggleChip('subjects', s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <MultiSelect
        label="Competency"
        allLabel="All competencies"
        searchable
        options={competencyMeta.map((c) => ({ value: c.Code, label: `${c.Code} — ${c.Desc}` }))}
        selected={selCompetencies}
        onChange={(v) => update({ competencies: v })}
      />

      {activeCount > 0 && (
        <button
          type="button"
          className="filter-reset"
          onClick={() => update({ blocks: [], grades: [], subjects: [], competencies: [] })}
        >
          Reset filters ({activeCount})
        </button>
      )}
    </div>
  )
}
