import { usePageAnalysis } from '../lib/usePageAnalysis'
import PageHeader from '../components/PageHeader'
import FilterBar from '../components/FilterBar'
import KpiCards from '../components/KpiCards'
import BlockLeaderboard from '../components/BlockLeaderboard'

export default function BlocksPage({ base }) {
  const { filters, setFilters, data } = usePageAnalysis(base)
  if (!data) return null
  const { competencyStats, blockStats, currentMonthInfo, filteredMonthInfo, topBlock, month } = data

  return (
    <>
      <PageHeader title="Blocks" subtitle="Block-wise ranking across the currently filtered competencies" />

      <FilterBar months={base.months} blocks={base.allBlocks} competencyMeta={base.meta} filters={filters} setFilters={setFilters} />

      <KpiCards
        districtAvgByMonth={competencyStats.districtAvgByMonth}
        selectedMonthKey={month}
        monthInfo={filteredMonthInfo}
        topBlock={topBlock}
      />

      <section className="panel">
        <h2>Block ranking — {currentMonthInfo?.label}</h2>
        <p className="panel-sub">Overall average across filtered competencies, by block</p>
        <BlockLeaderboard data={blockStats.byMonth[month]} />
      </section>
    </>
  )
}
