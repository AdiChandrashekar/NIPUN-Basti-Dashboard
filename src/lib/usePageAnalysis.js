import { useMemo, useState } from 'react'
import { computeBlockStats, computeCompetencyStats, computeSchoolTable, gradeWiseBestWorst, topBottomCompetencies } from './analysis'

const EMPTY_FILTERS = { month: '', blocks: [], grades: [], subjects: [], competencies: [] }

// Each page owns its own filter state and derived stats, computed from the
// same unfiltered `base` (rows/meta/months/allBlocks) — this is what lets
// Overview/Competencies/Blocks/Schools filter fully independently of one
// another instead of sharing one global filter set.
export function usePageAnalysis(base) {
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    month: base.months[base.months.length - 1]?.key ?? '',
  }))

  const data = useMemo(() => {
    const { rows, meta, months } = base
    const filteredRows = filters.blocks.length ? rows.filter((r) => filters.blocks.includes(r.Block)) : rows
    const filteredMeta = meta.filter(
      (c) =>
        (filters.grades.length === 0 || filters.grades.includes(c.Grade)) &&
        (filters.subjects.length === 0 || filters.subjects.includes(c.Subject)) &&
        (filters.competencies.length === 0 || filters.competencies.includes(c.Code))
    )
    const competencyStats = computeCompetencyStats(filteredRows, filteredMeta)
    const blockStats = computeBlockStats(filteredRows, filteredMeta)
    const month = filters.month && competencyStats.byMonth[filters.month] ? filters.month : months[months.length - 1]?.key
    if (!month) return null
    const schoolTable = computeSchoolTable(filteredRows, filteredMeta, month)
    const tb = topBottomCompetencies(competencyStats, month)
    const grades = gradeWiseBestWorst(competencyStats, month)
    const monthBlocks = blockStats.byMonth[month] || []
    const topBlock = [...monthBlocks].filter((b) => b.overall !== null).sort((a, b) => b.overall - a.overall)[0]
    const currentMonthInfo = months.find((m) => m.key === month)
    const filteredMonthN = filteredRows.filter((r) => r.Month === month).length
    const filteredBlockCount = monthBlocks.filter((b) => b.n > 0).length
    const filteredMonthInfo = currentMonthInfo && {
      ...currentMonthInfo,
      n: filteredMonthN,
      blockCount: filteredBlockCount,
    }
    return {
      filteredRows,
      filteredMeta,
      filteredMonthInfo,
      month,
      currentMonthInfo,
      competencyStats,
      blockStats,
      schoolTable,
      tb,
      grades,
      monthBlocks,
      topBlock,
    }
  }, [base, filters])

  return { filters, setFilters, data }
}
