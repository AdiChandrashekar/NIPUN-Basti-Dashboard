// Shapes raw SSP API rows (from sspApi.fetchSsp) into the same
// { label, n, perComp, nipunPct }[] table shape at district/block/school
// granularity, so SspPanel can render it identically to the NIPUN side.

function round(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return null
  const f = 10 ** d
  return Math.round(n * f) / f
}

function weightedMean(pairs) {
  const valid = pairs.filter((p) => typeof p.value === 'number' && !Number.isNaN(p.value) && p.weight > 0)
  const totalWeight = valid.reduce((a, p) => a + p.weight, 0)
  if (!totalWeight) return null
  return valid.reduce((a, p) => a + p.value * p.weight, 0) / totalWeight
}

// 'block' scope reads the pre-aggregated per-block dataset; district/school
// both read the per-school dataset (district then rolls schools up further).
export function datasetForLevel(level) {
  return level === 'block' ? 'blocks' : 'schools'
}

function perCompFor(row, competencies) {
  return competencies.map((c) => ({ code: c.code, label: c.label, avg: round(row[c.code]) }))
}

function nipunPctFor(row) {
  return row.totalStudents ? round((row.nipunStudents / row.totalStudents) * 100) : null
}

function buildDistrictRow(schools, competencies) {
  const totalStudents = schools.reduce((a, s) => a + (s.totalStudents || 0), 0)
  const nipunStudents = schools.reduce((a, s) => a + (s.nipunStudents || 0), 0)
  const perComp = competencies.map((c) => ({
    code: c.code,
    label: c.label,
    avg: round(weightedMean(schools.map((s) => ({ value: s[c.code], weight: s.totalStudents || 0 })))),
  }))
  return {
    key: 'district',
    label: 'Basti (District)',
    n: totalStudents,
    perComp,
    nipunPct: totalStudents ? round((nipunStudents / totalStudents) * 100) : null,
  }
}

function buildBlockRows(blocks, competencies) {
  return blocks
    .filter((b) => b.totalStudents > 0)
    .map((b) => ({
      key: `block:${b.block}`,
      label: b.block,
      n: b.totalStudents,
      perComp: perCompFor(b, competencies),
      nipunPct: nipunPctFor(b),
    }))
    .sort((a, b) => (b.nipunPct ?? -1) - (a.nipunPct ?? -1))
}

// Keyed by UDISE (not schoolName) — different schools can legitimately share
// the same display name, which would otherwise collide as a React key.
function buildSchoolRows(schools, competencies) {
  return schools
    .filter((s) => s.totalStudents > 0)
    .map((s) => ({
      key: `school:${s.udise}`,
      label: s.schoolName || s.udise,
      n: s.totalStudents,
      perComp: perCompFor(s, competencies),
      nipunPct: nipunPctFor(s),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// level: 'district' | 'block' | 'school'. apiRows: the array returned by
// fetchSsp for datasetForLevel(level). competencies: selected {code,label}[].
export function computeSspTable(level, apiRows, competencies) {
  if (level === 'district') return [buildDistrictRow(apiRows, competencies)]
  if (level === 'block') return buildBlockRows(apiRows, competencies)
  return buildSchoolRows(apiRows, competencies)
}
