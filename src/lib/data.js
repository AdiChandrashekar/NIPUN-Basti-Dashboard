// Loads public/data/basti.json (built by data-prep/build_data.py) and computes
// every number on the dashboard from it.
//
// The unit of analysis is a "result": one school's score on one learning
// outcome (LO) in one month, 0-100. For Apr-Jun 2026 the export gives that
// percentage directly; from Jul 2026 it gives achieved/assessed student counts,
// so the percentage is achieved / assessed and student totals are also known.

export const BANDS = [
  { key: 'b0', label: '0%', short: '0%', color: '#b02727', test: (v) => v === 0 },
  { key: 'b1', label: '1–49%', short: '1–49', color: '#f2a59d', test: (v) => v > 0 && v < 50 },
  { key: 'b2', label: '50–74%', short: '50–74', color: '#9ec5f4', test: (v) => v >= 50 && v < 75 },
  { key: 'b3', label: '75–100%', short: '75+', color: '#2a78d6', test: (v) => v >= 75 },
]

export const GRADES = ['1', '2', '3', '4', '5']
export const SUBJECTS = ['Hindi', 'Maths']
export const LOW_COVERAGE_RATIO = 0.3
export const MIN_SCHOOLS_FOR_RANKING = 10

export async function loadData() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/basti.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`data/basti.json: ${res.status}`)
  const raw = await res.json()
  const losByCode = Object.fromEntries(raw.los.map((l) => [l.code, { ...l, grade: String(l.grade), label: l.desc ? `${l.code} · ${l.desc}` : l.code }]))
  const maxSchools = Math.max(...raw.months.map((m) => m.schools))
  const months = raw.months.map((m) => ({ ...m, lowCoverage: m.schools < maxSchools * LOW_COVERAGE_RATIO }))
  // Flatten to one array of results per month.
  const results = {}
  for (const m of months) {
    const out = []
    for (const rec of raw.records[m.key]) {
      const school = raw.schools[rec.s]
      for (const [code, v] of Object.entries(rec.v)) {
        const lo = losByCode[code]
        const counted = Array.isArray(v)
        out.push({
          school,
          lo,
          code,
          grade: lo.grade,
          subject: lo.subject,
          block: school.block,
          pct: counted ? (v[0] / v[1]) * 100 : v,
          a: counted ? v[0] : null,
          n: counted ? v[1] : null,
          enrol: rec.e,
        })
      }
    }
    results[m.key] = out
  }
  const blocks = [...new Set(raw.schools.map((s) => s.block))].sort()
  return { months, los: Object.values(losByCode), losByCode, schools: raw.schools, results, blocks }
}

export function filterResults(list, f) {
  return list.filter(
    (r) =>
      (!f.block || r.block === f.block) &&
      (!f.grade || r.grade === f.grade) &&
      (!f.subject || r.subject === f.subject) &&
      (!f.lo || r.code === f.lo) &&
      (!f.area || r.school.area === f.area),
  )
}

// Summary of any set of results.
export function summarize(list) {
  if (!list.length) return { n: 0, avg: null, schools: 0, students: null, studentPct: null, bands: bandCounts([]) }
  const schools = new Set()
  let sum = 0
  let a = 0
  let n = 0
  let counted = 0
  for (const r of list) {
    sum += r.pct
    schools.add(r.school.udise)
    if (r.n != null) {
      a += r.a
      n += r.n
      counted++
    }
  }
  return {
    n: list.length,
    avg: sum / list.length,
    schools: schools.size,
    students: counted ? studentsAssessed(list) : null,
    studentPct: n ? (a / n) * 100 : null,
    bands: bandCounts(list),
  }
}

// Children assessed: for each school and grade, the largest "assessed" count of
// any LO (the same children are assessed on several LOs, so counts can't be summed).
export function studentsAssessed(list) {
  const max = new Map()
  for (const r of list) {
    if (r.n == null) continue
    const k = `${r.school.udise}|${r.grade}`
    max.set(k, Math.max(max.get(k) || 0, r.n))
  }
  let t = 0
  max.forEach((v) => (t += v))
  return t
}

export function bandCounts(list) {
  const out = { n: list.length }
  for (const b of BANDS) out[b.key] = 0
  for (const r of list) {
    const b = BANDS.find((x) => x.test(r.pct))
    if (b) out[b.key]++
  }
  return out
}

export function groupBy(list, keyFn) {
  const m = new Map()
  for (const r of list) {
    const k = keyFn(r)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

export function prevMonth(months, key) {
  const i = months.findIndex((m) => m.key === key)
  return i > 0 ? months[i - 1] : null
}

// One row per school for a month: average over its (filtered) results.
export function schoolRows(data, monthKey, f) {
  const cur = groupBy(filterResults(data.results[monthKey] || [], f), (r) => r.school.udise)
  const pm = prevMonth(data.months, monthKey)
  const prev = pm ? groupBy(filterResults(data.results[pm.key], f), (r) => r.school.udise) : new Map()
  return [...cur.entries()].map(([udise, list]) => {
    const s = summarize(list)
    const p = prev.has(udise) ? summarize(prev.get(udise)).avg : null
    return {
      udise,
      school: list[0].school,
      los: list.length,
      zero: list.filter((r) => r.pct === 0).length,
      avg: s.avg,
      students: s.students,
      grades: [...new Set(list.map((r) => r.grade))].sort().join(', '),
      change: p == null ? null : s.avg - p,
    }
  })
}

export function blockRows(data, monthKey, f) {
  const cur = groupBy(filterResults(data.results[monthKey] || [], { ...f, block: '' }), (r) => r.block)
  const pm = prevMonth(data.months, monthKey)
  const prev = pm ? groupBy(filterResults(data.results[pm.key], { ...f, block: '' }), (r) => r.block) : new Map()
  return data.blocks
    .map((block) => {
      const list = cur.get(block) || []
      const s = summarize(list)
      const p = prev.has(block) ? summarize(prev.get(block)).avg : null
      const hindi = summarize(list.filter((r) => r.subject === 'Hindi')).avg
      const maths = summarize(list.filter((r) => r.subject === 'Maths')).avg
      return { block, ...s, hindi, maths, change: s.avg == null || p == null ? null : s.avg - p }
    })
    .filter((b) => b.n > 0)
}

export function loRows(data, monthKey, f) {
  const cur = groupBy(filterResults(data.results[monthKey] || [], { ...f, lo: '' }), (r) => r.code)
  const pm = prevMonth(data.months, monthKey)
  const prev = pm ? groupBy(filterResults(data.results[pm.key], { ...f, lo: '' }), (r) => r.code) : new Map()
  return [...cur.entries()].map(([code, list]) => {
    const s = summarize(list)
    const p = prev.has(code) ? summarize(prev.get(code)).avg : null
    return { code, lo: data.losByCode[code], ...s, change: p == null ? null : s.avg - p }
  })
}

export function monthSeries(data, f, pick = (s) => s.avg) {
  return data.months.map((m) => {
    const s = summarize(filterResults(data.results[m.key], f))
    return s.n ? pick(s, m) : null
  })
}

// ---------------------------------------------------------------- formatting

export const pct = (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : `${v.toFixed(d)}%`)
export const int = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-IN'))
export const share = (part, whole, d = 0) => (whole ? `${((part / whole) * 100).toFixed(d)}%` : '—')
export function signed(v, unit = ' pts', d = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  const s = v > 0 ? '+' : v < 0 ? '−' : '±'
  return `${s}${Math.abs(v).toFixed(d)}${unit}`
}

// Status by score: the same 75 / 50 cut-offs as the score bands.
export function scoreStatus(v) {
  if (v == null) return 'neutral'
  return v >= 75 ? 'good' : v >= 50 ? 'warning' : 'critical'
}
