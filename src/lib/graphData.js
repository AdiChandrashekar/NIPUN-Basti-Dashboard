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
// Returns the same refs with { n, zeroCount, bandZero, bandLow, bandMid, bandHigh } merged in.
export async function resolveGraphEntries({ refs, base, nipunMonth, partnerQuarter }) {
  const partnerGrades = [...new Set(refs.filter((r) => r.source === 'partner').map((r) => r.grade))]
  const partnerSchoolsByGrade = await fetchPartnerSchoolsByGrade(partnerQuarter, partnerGrades)

  return refs.map((ref) => {
    const bands =
      ref.source === 'nipun'
        ? computeNipunBands(base.rows, nipunMonth, ref.code)
        : computePartnerBands(partnerSchoolsByGrade[ref.grade], ref.code)
    return { ...ref, ...bands }
  })
}
