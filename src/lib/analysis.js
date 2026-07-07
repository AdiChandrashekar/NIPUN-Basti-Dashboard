// Core analysis engine — mirrors the NIPUN Basti methodology (district/competency
// averages, score-band distribution, zero-scorer rates, block rankings, grade-wise
// best/weakest) but computed dynamically for however many months are present in
// the data. Adding a new month to Raw_Scores requires no changes here.

const LOW_COVERAGE_RATIO = 0.3 // a month with < 30% of the max month's N is flagged "preliminary"
const BAND_LOW = 50
const BAND_HIGH = 75

function mean(values) {
  const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x))
  if (v.length === 0) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}

function round(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return null
  const f = 10 ** d
  return Math.round(n * f) / f
}

export function getMonthList(rows) {
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.Month)) map.set(r.Month, { key: r.Month, label: r.MonthLabel, n: 0, blocks: new Set() })
    const m = map.get(r.Month)
    m.n += 1
    m.blocks.add(r.Block)
  }
  const months = [...map.values()]
    .map((m) => ({ key: m.key, label: m.label, n: m.n, blockCount: m.blocks.size }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
  const maxN = Math.max(...months.map((m) => m.n))
  return months.map((m) => ({ ...m, isLowCoverage: m.n < maxN * LOW_COVERAGE_RATIO, maxN }))
}

export function computeCompetencyStats(rows, meta) {
  const months = getMonthList(rows)
  const byMonth = {}
  for (const m of months) {
    const monthRows = rows.filter((r) => r.Month === m.key)
    const n = monthRows.length
    const perComp = meta.map((c) => {
      const values = monthRows.map((r) => r[c.Code]).filter((v) => typeof v === 'number' && !Number.isNaN(v))
      const avg = mean(values)
      const zeroCount = values.filter((v) => v === 0).length
      const lowCount = values.filter((v) => v > 0 && v < BAND_LOW).length
      const midCount = values.filter((v) => v >= BAND_LOW && v <= BAND_HIGH).length
      const highCount = values.filter((v) => v > BAND_HIGH).length
      const total = values.length || 1
      return {
        code: c.Code,
        desc: c.Desc,
        grade: c.Grade,
        subject: c.Subject,
        avg,
        n: values.length,
        zeroCount,
        zeroPct: zeroCount / total,
        bandZero: zeroCount / total,
        bandLow: lowCount / total,
        bandMid: midCount / total,
        bandHigh: highCount / total,
      }
    })
    byMonth[m.key] = { n, perComp }
  }

  // month-over-month deltas (each month vs the previous one in the sorted list)
  const deltas = {}
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1].key
    const cur = months[i].key
    deltas[cur] = byMonth[cur].perComp.map((c) => {
      const prevStat = byMonth[prev].perComp.find((p) => p.code === c.code)
      const chg = c.avg !== null && prevStat?.avg !== null && prevStat?.avg !== undefined ? c.avg - prevStat.avg : null
      const pct = chg !== null && prevStat.avg ? chg / prevStat.avg : null
      return { code: c.code, chg, pct }
    })
  }

  const districtAvgByMonth = months.map((m) => ({
    key: m.key,
    label: m.label,
    avg: round(mean(byMonth[m.key].perComp.map((c) => c.avg))),
    isLowCoverage: m.isLowCoverage,
  }))

  return { months, byMonth, deltas, districtAvgByMonth }
}

export function computeBlockStats(rows, meta) {
  const months = getMonthList(rows)
  const blocks = [...new Set(rows.map((r) => r.Block))].sort()
  const byMonth = {}
  for (const m of months) {
    const monthRows = rows.filter((r) => r.Month === m.key)
    const perBlock = blocks.map((block) => {
      const blockRows = monthRows.filter((r) => r.Block === block)
      const n = blockRows.length
      const compAvgs = meta.map((c) => {
        const values = blockRows.map((r) => r[c.Code]).filter((v) => typeof v === 'number' && !Number.isNaN(v))
        return mean(values)
      })
      const overall = mean(compAvgs.filter((v) => v !== null))
      return { block, n, overall: round(overall) }
    })
    // rank by overall avg, descending; blocks with 0 schools this month get null rank
    const ranked = [...perBlock]
      .filter((b) => b.overall !== null)
      .sort((a, b) => b.overall - a.overall)
    perBlock.forEach((b) => {
      const idx = ranked.findIndex((r) => r.block === b.block)
      b.rank = idx === -1 ? null : idx + 1
    })
    byMonth[m.key] = perBlock
  }
  return { months, blocks, byMonth }
}

// Full per-school table for a given month: average + zero-count over whatever
// competencies are passed in (already filtered by the caller), plus change vs
// the previous month in the sorted month list (not necessarily monthKey's
// immediate predecessor in real time, just the previous one with data).
export function computeSchoolTable(rows, meta, monthKey) {
  const months = getMonthList(rows)
  const idx = months.findIndex((m) => m.key === monthKey)
  if (idx === -1) return { rows: [], prevMonth: null }
  const monthRows = rows.filter((r) => r.Month === monthKey)
  const codes = meta.map((c) => c.Code)
  const rowAvg = (r) => mean(codes.map((c) => r[c]))
  const rowZero = (r) => codes.filter((c) => r[c] === 0).length

  const prevMonth = idx > 0 ? months[idx - 1] : null
  const prevByCode = prevMonth ? new Map(rows.filter((r) => r.Month === prevMonth.key).map((r) => [r.SchoolCode, r])) : null

  const table = monthRows.map((r) => {
    const avg = rowAvg(r)
    const zeroCount = rowZero(r)
    let change = null
    if (prevByCode && prevByCode.has(r.SchoolCode)) {
      const prevAvg = rowAvg(prevByCode.get(r.SchoolCode))
      change = avg !== null && prevAvg !== null ? round(avg - prevAvg) : null
    }
    return {
      block: r.Block,
      school: r.School,
      schoolCode: r.SchoolCode,
      total: r.Total,
      avg: round(avg),
      zeroCount,
      compCount: codes.length,
      change,
    }
  })

  return { rows: table, prevMonth }
}

// Month-by-month series for a set of blocks or a set of competency codes, for
// the Compare tab. dimension: 'block' | 'competency'.
export function computeCompareSeries(rows, meta, dimension, items) {
  const months = getMonthList(rows)
  const codes = meta.map((c) => c.Code)

  if (dimension === 'block') {
    const series = items.map((block) => ({
      key: block,
      label: block,
      values: months.map((m) => {
        const blockRows = rows.filter((r) => r.Month === m.key && r.Block === block)
        const avg = mean(blockRows.map((r) => mean(codes.map((c) => r[c]))))
        return { monthKey: m.key, monthLabel: m.label, avg: round(avg) }
      }),
    }))
    return { months, series }
  }

  // dimension === 'competency'
  const series = items.map((code) => {
    const compMeta = meta.find((c) => c.Code === code)
    return {
      key: code,
      label: code,
      desc: compMeta?.desc,
      values: months.map((m) => {
        const monthRows = rows.filter((r) => r.Month === m.key)
        const avg = mean(monthRows.map((r) => r[code]).filter((v) => typeof v === 'number' && !Number.isNaN(v)))
        return { monthKey: m.key, monthLabel: m.label, avg: round(avg) }
      }),
    }
  })
  return { months, series }
}

export function topBottomCompetencies(competencyStats, monthKey, count = 5) {
  const stat = competencyStats.byMonth[monthKey]
  if (!stat) return { top: [], bottom: [], mostImproved: [] }
  const withAvg = stat.perComp.filter((c) => c.avg !== null)
  const top = [...withAvg].sort((a, b) => b.avg - a.avg).slice(0, count)
  const bottom = [...withAvg].sort((a, b) => a.avg - b.avg).slice(0, count)
  const deltaList = competencyStats.deltas[monthKey] || []
  const merged = withAvg
    .map((c) => ({ ...c, delta: deltaList.find((d) => d.code === c.code)?.chg ?? null }))
    .filter((c) => c.delta !== null)
  const mostImproved = [...merged].sort((a, b) => b.delta - a.delta).slice(0, count)
  return { top, bottom, mostImproved }
}

export function gradeWiseBestWorst(competencyStats, monthKey) {
  const stat = competencyStats.byMonth[monthKey]
  if (!stat) return []
  const grades = ['G1', 'G2', 'G3']
  const subjects = ['Literacy', 'Numeracy']
  const out = []
  for (const grade of grades) {
    for (const subject of subjects) {
      const group = stat.perComp.filter((c) => c.grade === grade && c.subject === subject && c.avg !== null)
      if (group.length === 0) continue
      const best = [...group].sort((a, b) => b.avg - a.avg)[0]
      const worst = [...group].sort((a, b) => a.avg - b.avg)[0]
      out.push({ grade, subject, best, worst })
    }
  }
  return out
}

export { mean, round }
