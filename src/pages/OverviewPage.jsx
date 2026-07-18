import { usePageAnalysis } from '../lib/usePageAnalysis'
import PageHeader from '../components/PageHeader'
import FilterBar from '../components/FilterBar'
import KpiCards from '../components/KpiCards'
import TrendChart from '../components/TrendChart'
import DistributionChart from '../components/DistributionChart'
import GradeBreakdown from '../components/GradeBreakdown'

export default function OverviewPage({ base }) {
  const { filters, setFilters, data } = usePageAnalysis(base)
  if (!data) return null
  const { competencyStats, currentMonthInfo, filteredMonthInfo, topBlock, grades, month } = data

  return (
    <>
      <PageHeader title="Overview" subtitle="District-wide learning outcome summary" />

      <FilterBar months={base.months} blocks={base.allBlocks} competencyMeta={base.meta} filters={filters} setFilters={setFilters} />

      <KpiCards
        districtAvgByMonth={competencyStats.districtAvgByMonth}
        selectedMonthKey={month}
        monthInfo={filteredMonthInfo}
        topBlock={topBlock}
      />

      <section className="panel">
        <h2>District average over time</h2>
        <p className="panel-sub">Mean of the currently filtered competencies, by month</p>
        <TrendChart data={competencyStats.districtAvgByMonth} />
      </section>
      <section className="panel">
        <h2>Score band distribution</h2>
        <p className="panel-sub">Average share of schools in each score band, across filtered competencies</p>
        <DistributionChart byMonth={competencyStats.byMonth} months={base.months} />
      </section>
      <section className="panel">
        <h2>Grade-wise best &amp; weakest competency</h2>
        <p className="panel-sub">{currentMonthInfo?.label} — highest/lowest average within each grade &amp; subject group</p>
        <GradeBreakdown groups={grades} />
      </section>
    </>
  )
}
