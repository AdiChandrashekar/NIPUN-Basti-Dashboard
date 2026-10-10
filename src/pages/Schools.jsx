import { useMemo } from 'react'
import { DataTable, StatCard } from '../components/ui.jsx'
import { int, pct, prevMonth, schoolRows } from '../lib/data.js'
import { MonthNotices, MonthPills, PageHead } from './common.jsx'
import { Delta, ScoreCell } from './Competencies.jsx'

export default function Schools({ data, filters: f, nav }) {
  const month = data.months.find((m) => m.key === f.m)
  const pm = prevMonth(data.months, f.m)
  const rows = useMemo(() => schoolRows(data, f.m, f), [data, f])
  const below50 = rows.filter((r) => r.avg < 50).length
  const allZero = rows.filter((r) => r.zero === r.los).length
  const compared = rows.filter((r) => r.change != null)

  return (
    <>
      <PageHead crumb="Schools" title={`Schools · ${month.label}`}>
        <MonthPills data={data} f={f} />
      </PageHead>
      <MonthNotices data={data} monthKey={f.m} />

      <div className="stats">
        <StatCard label="Schools reporting" value={int(rows.length)} sub={`${f.block || 'Basti'} · ${month.label}`} />
        <StatCard label="Average below 50%" value={int(below50)} status={below50 ? 'critical' : 'neutral'} statusText="Needs support" sub={`${pct((below50 / (rows.length || 1)) * 100)} of schools reporting`} />
        <StatCard label="Every result at 0%" value={int(allZero)} sub="No child achieved any LO assessed" />
        <StatCard
          label={pm ? `Also reported in ${pm.label}` : 'Repeat schools'}
          value={pm ? int(compared.length) : '—'}
          sub={pm ? `${compared.filter((r) => r.change > 0).length} improved, ${compared.filter((r) => r.change < 0).length} declined` : 'First month of data'}
        />
      </div>

      <DataTable
        csvName={`nipunplus-basti-schools-${f.m}${f.block ? '-' + f.block : ''}.csv`}
        rows={rows}
        initialSort={{ key: 'avg', dir: 'asc' }}
        searchText={(r) => `${r.school.name} ${r.udise} ${r.school.block}`}
        onRowClick={(r) => nav('schools', r.udise)}
        empty="No schools reported under these filters."
        columns={[
          { key: 'name', label: 'School', value: (r) => r.school.name, render: (r) => <span className="link">{r.school.name}</span> },
          { key: 'block', label: 'Block', value: (r) => r.school.block },
          { key: 'udise', label: 'UDISE', value: (r) => r.udise },
          { key: 'grades', label: 'Grades', value: (r) => r.grades },
          { key: 'los', label: 'LOs', value: (r) => r.los, align: 'right' },
          { key: 'students', label: 'Children', value: (r) => r.students, align: 'right', render: (r) => int(r.students) },
          { key: 'avg', label: 'Average', value: (r) => r.avg, align: 'right', render: (r) => <ScoreCell v={r.avg} />, csv: (r) => r.avg?.toFixed(1) },
          { key: 'change', label: pm ? `vs ${pm.label}` : 'Change', value: (r) => r.change, align: 'right', render: (r) => <Delta v={r.change} />, csv: (r) => r.change?.toFixed(1) },
          { key: 'zero', label: 'LOs at 0%', value: (r) => r.zero, align: 'right' },
        ]}
      />
    </>
  )
}
