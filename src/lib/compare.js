// NIPUN+ against the Partner Org assessment, on one measure:
//
//   share of (child × skill) checks that were achieved / passed
//
// NIPUN+ (Jul 2026 on): children achieved ÷ children assessed, added up over the
//   subject's learning outcomes for the grade. (Apr–Jun files only hold school
//   percentages, so there it is the mean of the school's LO percentages.)
// Partner Org: the school's literacyPct / numeracyPct = the average, over its
//   children, of the share of the subject's competencies the child passed.
//
// Comparisons are made in the same grade, the same quarter and, wherever a single
// number is compared, only in schools assessed by both.

import { PARTNER_SUBJECT_FIELD, blockKey } from './partner.js'

export const BANDS3 = [
  { key: 0, label: 'Below 50%', short: '<50' },
  { key: 1, label: '50–74%', short: '50–74' },
  { key: 2, label: '75% or more', short: '75+' },
]
export const band3 = (v) => (v >= 75 ? 2 : v >= 50 ? 1 : 0)

export const CATEGORY = {
  nipun: { key: 'nipun', label: 'NIPUN+ higher', long: 'NIPUN+ puts the school in a higher band' },
  agree: { key: 'agree', label: 'Same band', long: 'Both sources put the school in the same band' },
  partner: { key: 'partner', label: 'Partner Org higher', long: 'The Partner Org puts the school in a higher band' },
}

/** NIPUN+ per-school values for a set of months, one grade and one subject. */
export function nipunSchools(data, monthKeys, grade, subject) {
  const out = new Map()
  for (const mk of monthKeys) {
    for (const r of data.results[mk] || []) {
      if (r.grade !== grade || r.subject !== subject) continue
      const u = r.school.udise
      if (!out.has(u)) out.set(u, { udise: u, school: r.school, a: 0, n: 0, pcts: [], los: new Set(), months: new Set() })
      const s = out.get(u)
      s.pcts.push(r.pct)
      s.los.add(r.code)
      s.months.add(mk)
      if (r.n != null) {
        s.a += r.a
        s.n += r.n
      }
    }
  }
  for (const s of out.values()) {
    s.counted = s.n > 0
    s.value = s.counted ? (s.a / s.n) * 100 : s.pcts.reduce((x, y) => x + y, 0) / s.pcts.length
  }
  return out
}

/** Partner Org per-school values for one subject. */
export function partnerSchools(rows, subject) {
  const field = PARTNER_SUBJECT_FIELD[subject]
  const out = new Map()
  for (const s of rows) {
    const v = s[field]
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    out.set(String(s.udise), { udise: String(s.udise), name: s.schoolName, block: s.block, value: v, students: s.totalStudents })
  }
  return out
}

// Aggregate of a list of NIPUN+ school entries: pooled counts when every school has
// them, otherwise the mean of school values.
export function nipunAggregate(list) {
  if (!list.length) return null
  if (list.every((s) => s.counted)) {
    const a = list.reduce((t, s) => t + s.a, 0)
    const n = list.reduce((t, s) => t + s.n, 0)
    return n ? (a / n) * 100 : null
  }
  return list.reduce((t, s) => t + s.value, 0) / list.length
}

export function partnerAggregate(list) {
  const w = list.reduce((t, s) => t + s.students, 0)
  return w ? list.reduce((t, s) => t + s.value * s.students, 0) / w : null
}

// A school counts as having "enough data" with 5+ NIPUN+ checks (child × LO) and
// 5+ Partner Org children. Apr–Jun NIPUN+ files have no counts, so only the
// Partner Org side is tested there.
export const MIN_EVIDENCE = 5
export const enoughData = (n, p) => (!n.counted || n.n >= MIN_EVIDENCE) && p.students >= MIN_EVIDENCE

/** Everything the comparison page shows, for one subject. */
export function compareSubject(data, partnerRows, monthKeys, grade, subject, { onlyEnough = true } = {}) {
  const N = nipunSchools(data, monthKeys, grade, subject)
  const P = partnerSchools(partnerRows, subject)
  const matched = []
  let inBoth = 0
  for (const [u, n] of N) {
    const p = P.get(u)
    if (!p) continue
    inBoth++
    if (onlyEnough && !enoughData(n, p)) continue
    const nb = band3(n.value)
    const pb = band3(p.value)
    matched.push({ udise: u, n, p, gap: n.value - p.value, nb, pb, cat: nb > pb ? 'nipun' : nb < pb ? 'partner' : 'agree' })
  }
  const matrix = BANDS3.map(() => BANDS3.map(() => 0))
  matched.forEach((m) => matrix[m.nb][m.pb]++)
  const count = (cat) => matched.filter((m) => m.cat === cat).length

  // Blocks, from matched schools only, named as in NIPUN+.
  const byBlock = new Map()
  for (const m of matched) {
    const k = blockKey(m.n.school.block)
    if (!byBlock.has(k)) byBlock.set(k, { key: k, label: m.n.school.block, list: [] })
    byBlock.get(k).list.push(m)
  }
  const blocks = [...byBlock.values()].map((b) => ({
    ...b,
    nipun: nipunAggregate(b.list.map((m) => m.n)),
    partner: partnerAggregate(b.list.map((m) => m.p)),
    schools: b.list.length,
    children: b.list.reduce((t, m) => t + m.p.students, 0),
  }))

  return {
    subject,
    nipunAll: { schools: N.size, value: nipunAggregate([...N.values()]) },
    partnerAll: { schools: P.size, value: partnerAggregate([...P.values()]), children: [...P.values()].reduce((t, s) => t + s.students, 0) },
    coverage: { onlyNipun: N.size - inBoth, both: inBoth, onlyPartner: P.size - inBoth },
    excluded: inBoth - matched.length,
    matched,
    nipun: nipunAggregate(matched.map((m) => m.n)),
    partner: partnerAggregate(matched.map((m) => m.p)),
    children: matched.reduce((t, m) => t + m.p.students, 0),
    checks: matched.reduce((t, m) => t + m.n.n, 0),
    counted: matched.length > 0 && matched.every((m) => m.n.counted),
    matrix,
    agree: count('agree'),
    nipunHigher: count('nipun'),
    partnerHigher: count('partner'),
    blocks,
  }
}
