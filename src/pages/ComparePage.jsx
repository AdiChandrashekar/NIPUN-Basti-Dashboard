import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import CompareView from '../components/CompareView'
import { computeBlockStats, computeCompetencyStats, topBottomCompetencies } from '../lib/analysis'

export default function ComparePage({ base }) {
  const setup = useMemo(() => {
    const month = base.months[base.months.length - 1]?.key
    const blockStats = computeBlockStats(base.rows, base.meta)
    const competencyStats = computeCompetencyStats(base.rows, base.meta)
    const tb = topBottomCompetencies(competencyStats, month)
    const defaultBlocks = [...(blockStats.byMonth[month] || [])]
      .filter((b) => b.overall !== null)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 3)
      .map((b) => b.block)
    const defaultCompetencies = tb.bottom.slice(0, 5).map((c) => c.code)
    return { month, blocks: blockStats.blocks, defaultBlocks, defaultCompetencies }
  }, [base])

  return (
    <>
      <PageHeader title="Compare" subtitle="Trend selected blocks or competencies against each other across all months" />
      <CompareView
        rows={base.rows}
        meta={base.meta}
        blocks={setup.blocks}
        competencyMeta={base.meta}
        selectedMonth={setup.month}
        defaultBlocks={setup.defaultBlocks}
        defaultCompetencies={setup.defaultCompetencies}
      />
    </>
  )
}
