// Suspicious NIPUN+ results: per-school signals that results may be inflated.
//
// Six signals come from the NIPUN+ data alone (what a school reports, compared
// with what the rest of Basti reports for the same learning outcome in the same
// month); one uses CSF's independent assessment of the same school. Every
// threshold sits around the top 5% of Basti schools (calibrated Oct 2026), so a
// signal means "unusual for Basti", not "wrong". Signals are pooled over every
// month a school reported; persistence is shown separately, month by month.

import { nipunSchools, partnerSchools } from './compare.js'
import { QUARTERS } from './partner.js'

export const MIN_RESULTS = 8 // results a school needs before its pooled signals are judged
const MIN_CHILDREN = 3 // results from fewer children are left out of the all-or-nothing check
export const CSF_GAP = 25
const CSF_MIN = 5

export const SIGNALS = [
  {
    key: 'perfect',
    label: 'Mostly perfect scores',
    short: 'Perfect',
    rule: '70%+ of the school’s results are 100% (every child tested achieved the LO)',
    why: 'Real classes rarely have every child achieve most learning outcomes.',
    threshold: 0.7,
    fmt: (v) => `${Math.round(v * 100)}%`,
    axis: 'Share of results at 100%',
    source: 'nipun',
  },
  {
    key: 'excess',
    label: 'Far above Basti',
    short: 'Above Basti',
    rule: 'On average 20+ pts above the Basti average for the same LO in the same month',
    why: 'Compares like with like: each result against other schools on the same LO and month.',
    threshold: 20,
    fmt: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))} pts`,
    axis: 'Average pts above Basti on the same LOs',
    source: 'nipun',
  },
  {
    key: 'above',
    label: 'Above Basti on nearly everything',
    short: 'Always above',
    rule: '90%+ of the school’s results are above the Basti average for that LO and month',
    why: 'Even strong schools have weaker LOs; being above on almost all of them is unusual.',
    threshold: 0.9,
    fmt: (v) => `${Math.round(v * 100)}%`,
    axis: 'Share of results above Basti',
    source: 'nipun',
  },
  {
    key: 'allornothing',
    label: 'No partial results',
    short: 'All or nothing',
    rule: `90%+ of results (from ${MIN_CHILDREN}+ children) are exactly 0% or 100%`,
    why: 'Testing children one by one normally gives some in-between results; all-or-nothing suggests whole-class marking.',
    threshold: 0.9,
    fmt: (v) => `${Math.round(v * 100)}%`,
    axis: 'Share of results at 0% or 100%',
    source: 'nipun',
  },
  {
    key: 'wholeclass',
    label: 'Whole class passes',
    short: 'Whole class',
    rule: '2+ LOs where 90%+ of the grade’s enrolled children (5+) were tested and every one achieved it',
    why: 'Full attendance and a 100% pass on the same day, more than once, is rare. Child counts exist from Jul 2026.',
    threshold: 2,
    fmt: (v) => `${v} LO${v === 1 ? '' : 's'}`,
    axis: 'LOs where the whole class passed',
    source: 'nipun',
  },
  {
    key: 'jump',
    label: 'Sudden jump',
    short: 'Jump',
    rule: 'School average rose 40+ pts from one month to the next (5+ results in both)',
    why: 'Learning rarely moves that fast in a month.',
    threshold: 40,
    fmt: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))} pts`,
    axis: 'Largest month-to-month rise',
    source: 'nipun',
  },
  {
    key: 'csf',
    label: 'Far above CSF',
    short: 'Above CSF',
    rule: `NIPUN+ ${CSF_GAP}+ pts above CSF’s own assessment of the same school, grade, subject and quarter`,
    why: `Independent check. Needs ${CSF_MIN}+ NIPUN+ checks and ${CSF_MIN}+ CSF children.`,
    threshold: CSF_GAP,
    fmt: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))} pts`,
    axis: 'Largest gap, NIPUN+ − CSF',
    source: 'csf',
  },
]
export const SIGNAL = Object.fromEntries(SIGNALS.map((s) => [s.key, s]))

// Checks that measure the same thing count once: levels are built from independent
// lines of evidence, not from the number of checks tripped.
export const LINES = [
  { key: 'level', label: 'Results too high', signals: ['perfect', 'excess', 'above'] },
  { key: 'pattern', label: 'Implausible pattern', signals: ['allornothing', 'wholeclass'] },
  { key: 'jump', label: 'Sudden jump', signals: ['jump'] },
  { key: 'persistent', label: 'Persistent', signals: [] },
  { key: 'csf', label: 'CSF disagrees', signals: ['csf'] },
]

export const TIERS = {
  strong: { key: 'strong', label: 'Strong', long: 'CSF confirms it, or 3+ independent lines of evidence' },
  watch: { key: 'watch', label: 'Watch', long: '2 independent lines of evidence' },
  single: { key: 'single', label: 'One line', long: 'One line of evidence' },
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** NIPUN+-only metrics for every school, plus the per-month detail. */
export function nipunMetrics(data) {
  // Basti average for each LO in each month: the "expected" result.
  const expected = new Map()
  for (const m of data.months) {
    const sums = new Map()
    for (const r of data.results[m.key]) {
      const s = sums.get(r.code) || [0, 0]
      s[0] += r.pct
      s[1]++
      sums.set(r.code, s)
    }
    sums.forEach(([t, n], code) => expected.set(`${m.key}|${code}`, t / n))
  }

  const bySchool = new Map()
  for (const m of data.months) {
    for (const r of data.results[m.key]) {
      const u = r.school.udise
      if (!bySchool.has(u)) bySchool.set(u, { school: r.school, results: [] })
      bySchool.get(u).results.push({ ...r, month: m.key, ex: r.pct - expected.get(`${m.key}|${r.code}`) })
    }
  }

  const out = new Map()
  for (const [u, { school, results }] of bySchool) {
    const n = results.length
    const big = results.filter((r) => r.n == null || r.n >= MIN_CHILDREN)
    const whole = results.filter((r) => r.n != null && r.n >= 5 && r.enrol[r.grade] > 0 && r.n >= 0.9 * r.enrol[r.grade] && r.a === r.n)
    const months = data.months
      .filter((m) => results.some((r) => r.month === m.key))
      .map((m) => {
        const rs = results.filter((r) => r.month === m.key)
        return {
          key: m.key,
          label: m.label,
          n: rs.length,
          avg: mean(rs.map((r) => r.pct)),
          expected: mean(rs.map((r) => r.pct - r.ex)),
          perfect: rs.filter((r) => r.pct === 100).length / rs.length,
          excess: mean(rs.map((r) => r.ex)),
          results: rs,
        }
      })
    let jump = null
    let jumpAt = null
    for (let i = 1; i < months.length; i++) {
      const a = months[i - 1]
      const b = months[i]
      const consecutive = data.months.findIndex((m) => m.key === b.key) - data.months.findIndex((m) => m.key === a.key) === 1
      if (!consecutive || a.n < 5 || b.n < 5) continue
      const rise = b.avg - a.avg
      if (jump == null || rise > jump) {
        jump = rise
        jumpAt = `${a.label.split(' ')[0]} → ${b.label}`
      }
    }
    out.set(u, {
      udise: u,
      school,
      n,
      months,
      metrics: {
        perfect: results.filter((r) => r.pct === 100).length / n,
        excess: mean(results.map((r) => r.ex)),
        above: results.filter((r) => r.ex > 0).length / n,
        allornothing: big.length >= MIN_RESULTS ? big.filter((r) => r.pct === 0 || r.pct === 100).length / big.length : null,
        wholeclass: whole.length,
        jump,
      },
      wholeList: whole,
      jumpAt,
    })
  }
  return out
}

/** CSF comparisons for every school: every quarter with NIPUN+ data, every grade, both subjects. */
export function csfComparisons(data, partnerByQuarter) {
  const out = new Map()
  for (const q of QUARTERS) {
    const byGrade = partnerByQuarter[q.key]
    if (!byGrade) continue
    const monthKeys = data.months.filter((m) => q.months.includes(m.key)).map((m) => m.key)
    if (!monthKeys.length) continue
    for (const [grade, rows] of Object.entries(byGrade)) {
      for (const subject of ['Hindi', 'Maths']) {
        const N = nipunSchools(data, monthKeys, grade, subject)
        const P = partnerSchools(rows, subject)
        for (const [u, nv] of N) {
          const pv = P.get(u)
          if (!pv || pv.students < CSF_MIN || (nv.counted && nv.n < CSF_MIN)) continue
          if (!out.has(u)) out.set(u, [])
          out.get(u).push({ quarter: q.key, quarterLabel: q.label, grade, subject, nipun: nv.value, csf: pv.value, gap: nv.value - pv.value, children: pv.students, checks: nv.counted ? nv.n : null })
        }
      }
    }
  }
  return out
}

/** Every school with its signals, tier and evidence. */
export function screenSchools(data, partnerByQuarter) {
  const nm = nipunMetrics(data)
  const csf = partnerByQuarter ? csfComparisons(data, partnerByQuarter) : new Map()
  const schools = []
  for (const [u, s] of nm) {
    const enough = s.n >= MIN_RESULTS
    const comps = csf.get(u) || []
    const maxGap = comps.length ? Math.max(...comps.map((c) => c.gap)) : null
    const metrics = { ...s.metrics, csf: maxGap }
    const flags = SIGNALS.filter((sig) => {
      const v = metrics[sig.key]
      if (v == null) return false
      // Pooled NIPUN+ signals need enough results; whole-class, jump and CSF carry their own minimums.
      if (['perfect', 'excess', 'above', 'allornothing'].includes(sig.key) && !enough) return false
      return v >= sig.threshold
    }).map((sig) => sig.key)
    // Persistent: above Basti by 15+ pts in every month reported (2+ months with 3+ results).
    const solid = s.months.filter((m) => m.n >= 3)
    const persistent = solid.length >= 2 && solid.every((m) => m.excess >= 15)
    const lines = LINES.filter((l) => (l.key === 'persistent' ? persistent : l.signals.some((k) => flags.includes(k)))).map((l) => l.key)
    const internal = lines.filter((k) => k !== 'csf').length
    const csfFlag = lines.includes('csf')
    const tier = (csfFlag && internal >= 1) || internal >= 3 ? 'strong' : lines.length >= 2 ? 'watch' : lines.length === 1 ? 'single' : null
    schools.push({ ...s, enough, metrics, flags, lines, internal, tier, comps, persistent, score: lines.length * 10 + flags.length })
  }
  return schools
}

/** Does the NIPUN+-only screen agree with CSF? Schools with CSF comparisons, split by internal signals. */
export function validation(schools) {
  const withCsf = schools.filter((s) => s.comps.length && s.enough)
  const avgGap = (list) => mean(list.map((s) => mean(s.comps.map((c) => c.gap))))
  // Only NIPUN+ checks here: the point is whether they find what CSF finds.
  const nipunFlag = (s) => s.flags.some((k) => k !== 'csf')
  const flagged = withCsf.filter(nipunFlag)
  const clean = withCsf.filter((s) => !nipunFlag(s))
  return {
    n: withCsf.length,
    flagged: { n: flagged.length, gap: avgGap(flagged) },
    clean: { n: clean.length, gap: avgGap(clean) },
    points: withCsf.map((s) => ({ s, x: s.metrics.excess, y: mean(s.comps.map((c) => c.gap)) })),
  }
}
