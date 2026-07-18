import { usePageAnalysis } from '../lib/usePageAnalysis'
import PageHeader from '../components/PageHeader'
import FilterBar from '../components/FilterBar'
import KpiCards from '../components/KpiCards'
import SchoolsTable from '../components/SchoolsTable'

export default function SchoolsPage({ base }) {
  const { filters, setFilters, data } = usePageAnalysis(base)
  if (!data) return null
  const { competencyStats, schoolTable, filteredMeta, currentMonthInfo, filteredMonthInfo, topBlock, month } = data

  return (
    <>
      <PageHeader title="Schools" subtitle="Every school, sortable and searchable" />

      <FilterBar months={base.months} blocks={base.allBlocks} competencyMeta={base.meta} filters={filters} setFilters={setFilters} />

      <KpiCards
        districtAvgByMonth={competencyStats.districtAvgByMonth}
        selectedMonthKey={month}
        monthInfo={filteredMonthInfo}
        topBlock={topBlock}
      />

      <section className="panel">
        <h2>All schools — {currentMonthInfo?.label}</h2>
        <p className="panel-sub">Sortable, searchable · averages computed over the currently filtered competencies</p>
        <SchoolsTable data={schoolTable.rows} prevMonthLabel={schoolTable.prevMonth?.label} compCount={filteredMeta.length} />
      </section>
    </>
  )
}
