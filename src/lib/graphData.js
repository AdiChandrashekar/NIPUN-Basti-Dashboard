// Resolves the graph builder's competency selections (a mix of NIPUN+ CSV
// refs and Partner Org API refs) into a common computed shape, district-wide.
import { computeBands } from './bands'
import { fetchSsp } from './sspApi'

function computeNipunBands(rows, month, code) {
  const monthRows = rows.filter((r) => r.Month === month)
  const values = monthRows.map((r) => r[code]).filter((v) => typeof v === 'number' && !Number.isNaN(v))
  return computeBands(values)
}

function computePartnerBands(schoolRows, code) {
  const values = (schoolRows || []).map((s) => s[code]).filter((v) => typeof v === 'number' && !Number.isNaN(v))
  return computeBands(values)
}

// A competency's raw score is only meaningful compared within its own grade
// (the max score, and therefore the pass-rate scale, differs by grade), so
// Partner Org data is fetched per distinct grade actually referenced rather
// than once for "all grades" combined.
async function fetchPartnerSchoolsByGrade(quarter, grades) {
  const byGrade = {}
  await Promise.all(
    grades.map(async (grade) => {
      byGrade[grade] = await fetchSsp('schools', { quarter, grade })
    })
  )
  return byGrade
}

// refs: [{ id, source: 'nipun' | 'partner', code, label, grade, subject }]
// Returns { entries, partnerTotalStudents, nipunTotalSchools }.
// entries: the same refs with { n, zeroCount, bandZero, bandLow, bandMid, bandHigh } merged in.
// partnerTotalStudents: sum of totalStudents across every grade's school dataset actually
// fetched for this selection (each grade's totalStudents is already grade-scoped server-side,
// so summing across distinct grades is additive, not double-counting).
// nipunTotalSchools: schools assessed in nipunMonth (adaptive to the month filter only —
// the CSV has no grade-scoped rows to filter by, unlike the Partner Org side).
export async function resolveGraphEntries({ refs, base, nipunMonth, partnerQuarter }) {
  const partnerGrades = [...new Set(refs.filter((r) => r.source === 'partner').map((r) => r.grade))]
  const partnerSchoolsByGrade = await fetchPartnerSchoolsByGrade(partnerQuarter, partnerGrades)

  const entries = refs.map((ref) => {
    const bands =
      ref.source === 'nipun'
        ? computeNipunBands(base.rows, nipunMonth, ref.code)
        : computePartnerBands(partnerSchoolsByGrade[ref.grade], ref.code)
    return { ...ref, ...bands }
  })

  const partnerTotalStudents = Object.values(partnerSchoolsByGrade)
    .flat()
    .reduce((sum, s) => sum + (s.totalStudents || 0), 0)
  const nipunTotalSchools = base.rows.filter((r) => r.Month === nipunMonth).length

  return { entries, partnerTotalStudents, nipunTotalSchools }
}
