import { useMemo } from 'react'
import { BarList, Heatmap, LevelBar } from '../components/charts.jsx'
import { ChartCard, DataTable, Section } from '../components/ui.jsx'
import { BANDS, blockRows, filterResults, groupBy, int, pct, prevMonth, scoreStatus, share, summarize } from '../lib/data.js'
import { MonthNotices, MonthPills, PageHead, monthXs } from './common.jsx'
import { Delta, ScoreCell } from './Competencies.jsx'

export default function Blocks({ data, filters: f, setFilters, nav }) {
  const month = data.months.find((m) => m.key === f.m)
  const pm = prevMonth(data.months, f.m)
  const rows = useMemo(() => blockRows(data, f.m, f), [data, f])
  const district = summarize(filterResults(data.results[f.m], { ...f, block: '' }))
  const ranked = [...rows].sort((a, b) => b.avg - a.avg)

  const cells = useMemo(() => {
    const out = {}
    for (const m of data.months) {
      groupBy(filterResults(data.results[m.key], { ...f, block: '' }), (r) => r.block).forEach((list, block) => (out[`${block}|${m.key}`] = summarize(list)))
    }
    return out
  }, [data, f.grade, f.subject, f.area, f.lo])
  const xs = monthXs(data)

  return (
    <>
      <PageHead crumb="Blocks" title={`Blocks · ${month.label}`}>
        <MonthPills data={data} f={{ ...f, block: '' }} />
      </PageHead>
      <MonthNotices data={data} monthKey={f.m} />

      <div className="grid-2">
        <ChartCard title="Block ranking" sub={`Average school result · line = Basti average (${pct(district.avg)}) · click to see the block's schools`}>
          {ranked.length === 0 ? (
            <div className="empty">No results under these filters.</div>
          ) : (
            <BarList
              data={ranked.map((b) => ({
                key: b.block,
                label: b.block,
                value: b.avg,
                status: scoreStatus(b.avg),
                sub: `${b.schools} schools`,
                tip: `${b.block}: ${pct(b.avg)} across ${b.schools} schools`,
              }))}
              reference={district.avg}
              onSelect={(block) => nav('schools', null, { ...f, block })}
            />
          )}
        </ChartCard>

        <ChartCard title="Blocks over time" sub="Average school result by month · number in each cell is the % · hover for schools">
          <Heatmap
            rows={data.blocks.filter((b) => data.months.some((m) => cells[`${b}|${m.key}`])).map((b) => ({ key: b, label: b }))}
            cols={data.months.map((m, i) => ({ key: m.key, label: xs[i].label }))}
            cell={(b, mk) => {
              const s = cells[`${b}|${mk}`]
              if (!s) return { value: null, text: '·', tip: 'No results' }
              return { value: s.avg, text: `${Math.round(s.avg)}`, muted: s.schools < 5, tip: `${b}: ${pct(s.avg)} · ${s.schools} schools, ${s.n} results` }
            }}
            onRowClick={(block) => setFilters({ block: block === f.block ? '' : block })}
            selectedRow={f.block}
            legend={{ label: 'Average result', note: 'faded = fewer than 5 schools' }}
          />
        </ChartCard>
      </div>

      <Section title={`Block table · ${month.label}`} sub="Sortable · click a block to see its schools">
        <DataTable
          csvName={`nipunplus-basti-blocks-${f.m}.csv`}
          rows={rows}
          initialSort={{ key: 'avg', dir: 'desc' }}
          searchable={false}
          onRowClick={(r) => nav('schools', null, { ...f, block: r.block })}
          columns={[
            { key: 'block', label: 'Block', value: (r) => r.block },
            { key: 'schools', label: 'Schools', value: (r) => r.schools, align: 'right', render: (r) => int(r.schools) },
            { key: 'n', label: 'Results', value: (r) => r.n, align: 'right', render: (r) => int(r.n) },
            { key: 'students', label: 'Children', value: (r) => r.students, align: 'right', render: (r) => int(r.students) },
            { key: 'avg', label: 'Average', value: (r) => r.avg, align: 'right', render: (r) => <ScoreCell v={r.avg} /> },
            { key: 'change', label: pm ? `vs ${pm.label}` : 'Change', value: (r) => r.change, align: 'right', render: (r) => <Delta v={r.change} />, csv: (r) => r.change?.toFixed(1) },
            { key: 'hindi', label: 'Hindi', value: (r) => r.hindi, align: 'right', render: (r) => pct(r.hindi) },
            { key: 'maths', label: 'Maths', value: (r) => r.maths, align: 'right', render: (r) => pct(r.maths) },
            { key: 'spread', label: 'Spread', sortable: false, value: (r) => BANDS.map((b) => `${b.short}: ${r.bands[b.key]}`).join(' '), render: (r) => <LevelBar s={r.bands} levels={BANDS} /> },
            { key: 'zero', label: 'At 0%', value: (r) => r.bands.b0 / r.n, align: 'right', render: (r) => share(r.bands.b0, r.n) },
          ]}
        />
      </Section>
    </>
  )
}
