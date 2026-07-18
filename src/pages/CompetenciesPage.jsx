import { usePageAnalysis } from '../lib/usePageAnalysis'
import PageHeader from '../components/PageHeader'
import FilterBar from '../components/FilterBar'
import KpiCards from '../components/KpiCards'
import CompetencyTable from '../components/CompetencyTable'

export default function CompetenciesPage({ base }) {
  const { filters, setFilters, data } = usePageAnalysis(base)
  if (!data) return null
  const { competencyStats, currentMonthInfo, filteredMonthInfo, topBlock, month } = data

  return (
    <>
      <PageHeader title="Competencies" subtitle="Sub-skill averages, sortable and filterable by month" />

      <FilterBar months={base.months} blocks={base.allBlocks} competencyMeta={base.meta} filters={filters} setFilters={setFilters} />

      <KpiCards
        districtAvgByMonth={competencyStats.districtAvgByMonth}
        selectedMonthKey={month}
        monthInfo={filteredMonthInfo}
        topBlock={topBlock}
      />

      <section className="panel">
        <h2>Competencies — {currentMonthInfo?.label}</h2>
        <p className="panel-sub">Sortable · change shown vs previous month · respects active filters</p>
        <CompetencyTable perComp={competencyStats.byMonth[month].perComp} deltas={competencyStats.deltas[month]} />
      </section>
    </>
  )
}
