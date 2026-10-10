import { useMemo } from 'react'
import { BarList, ColumnChart, Heatmap, LineChart, StackedShareChart } from '../components/charts.jsx'
import { ChartCard, StatCard } from '../components/ui.jsx'
import {
  BANDS,
  GRADES,
  MIN_SCHOOLS_FOR_RANKING,
  SUBJECTS,
  blockRows,
  filterResults,
  int,
  loRows,
  monthSeries,
  pct,
  prevMonth,
  scoreStatus,
  share,
  signed,
  summarize,
} from '../lib/data.js'
import { MonthNotices, MonthPills, PageHead, formatBreak, monthXs } from './common.jsx'

export default function Overview({ data, filters: f, setFilters, nav }) {
  const month = data.months.find((m) => m.key === f.m)
  const pm = prevMonth(data.months, f.m)

  const v = useMemo(() => {
    const cur = summarize(filterResults(data.results[f.m], f))
    const prev = pm ? summarize(filterResults(data.results[pm.key], f)) : null
    const bySubject = Object.fromEntries(SUBJECTS.map((s) => [s, monthSeries(data, { ...f, subject: s })]))
    const overall = monthSeries(data, f)
    const schoolsSeries = data.months.map((m) => summarize(filterResults(data.results[m.key], f)))
    const blocks = blockRows(data, f.m, f).sort((a, b) => b.avg - a.avg)
    const los = loRows(data, f.m, f).filter((l) => l.schools >= MIN_SCHOOLS_FOR_RANKING)
    return { cur, prev, bySubject, overall, schoolsSeries, blocks, los }
  }, [data, f, pm])

  const { cur, prev } = v
  // Only blocks with enough schools are named in the summary sentence.
  const rankable = v.blocks.filter((b) => b.schools >= MIN_SCHOOLS_FOR_RANKING)
  const xs = monthXs(data)
  const delta = cur.avg != null && prev?.avg != null ? cur.avg - prev.avg : null
  const weakest = [...v.los].sort((a, b) => a.avg - b.avg).slice(0, 8)
  const strongest = [...v.los].sort((a, b) => b.avg - a.avg).slice(0, 8)
  const gradeRows = GRADES.flatMap((g) => SUBJECTS.map((s) => ({ key: `${g}|${s}`, label: `Grade ${g} · ${s}`, grade: g, subject: s, group: `Grade ${g}` })))
  const gradeCells = useMemo(() => {
    const out = {}
    for (const m of data.months) {
      const list = filterResults(data.results[m.key], { ...f, grade: '', subject: '' })
      for (const r of gradeRows) out[`${r.key}|${m.key}`] = summarize(list.filter((x) => x.grade === r.grade && x.subject === r.subject))
    }
    return out
  }, [data, f])
  const visibleGradeRows = gradeRows.filter(
    (r) => (!f.grade || r.grade === f.grade) && (!f.subject || r.subject === f.subject) && data.months.some((m) => gradeCells[`${r.key}|${m.key}`].n),
  )

  if (!cur.n) {
    return (
      <>
        <PageHead crumb="Overview" title={`Basti · ${month.label}`}>
          <MonthPills data={data} f={f} />
        </PageHead>
        <div className="empty card">No results match these filters in {month.label}. Try another month or clear a filter.</div>
      </>
    )
  }

  return (
    <>
      <PageHead crumb="Overview" title={`Basti · ${month.label}`}>
        <MonthPills data={data} f={f} />
      </PageHead>
      <MonthNotices data={data} monthKey={f.m} />

      <p className="narrative">
        In <strong>{month.label}</strong>, <strong>{int(cur.schools)} schools</strong> recorded <strong>{int(cur.n)} learning-outcome results</strong>
        {cur.students != null && (
          <>
            {' '}
            covering at least <strong>{int(cur.students)} children</strong>
          </>
        )}
        . The average school result was <strong>{pct(cur.avg)}</strong>
        {delta != null && (
          <>
            {' '}
            ({signed(delta)} on {pm.label})
          </>
        )}
        . <strong>{share(cur.bands.b3, cur.n)}</strong> of results were 75% or higher and <strong>{share(cur.bands.b0, cur.n)}</strong> were 0%.
        {rankable.length > 1 && (
          <>
            {' '}
            Among blocks with {MIN_SCHOOLS_FOR_RANKING}+ schools reporting, {rankable[0].block} had the highest average ({pct(rankable[0].avg)}) and{' '}
            {rankable[rankable.length - 1].block} the lowest ({pct(rankable[rankable.length - 1].avg)}).
          </>
        )}
      </p>

      <div className="stats">
        <StatCard label="Average school result" value={pct(cur.avg)} status={scoreStatus(cur.avg)} sub={delta == null ? 'No earlier month to compare' : `${signed(delta)} vs ${pm.label}`} />
        <StatCard
          label="Schools reporting"
          value={int(cur.schools)}
          sub={prev ? `${signed(cur.schools - prev.schools, '', 0)} vs ${pm.label}` : `of ${int(data.schools.length)} schools seen in any month`}
        />
        <StatCard
          label={cur.students != null ? 'Children assessed' : 'Results recorded'}
          value={int(cur.students ?? cur.n)}
          sub={cur.students != null ? `${int(cur.n)} school × LO results · ${pct(cur.studentPct)} of children achieved` : 'Child counts start Jul 2026'}
        />
        <StatCard label="Results at 75%+" value={share(cur.bands.b3, cur.n)} sub={`${int(cur.bands.b3)} of ${int(cur.n)} results`} />
        <StatCard
          label="Results at 0%"
          value={share(cur.bands.b0, cur.n)}
          status={cur.bands.b0 / cur.n > 0.15 ? 'critical' : 'neutral'}
          statusText="More than 1 in 7 results"
          sub={`${int(cur.bands.b0)} results where no child achieved the LO`}
        />
      </div>

      <div className="grid-2">
        <ChartCard
          title="Average school result by month"
          sub="Mean of every school's result on every learning outcome assessed · click a month to open it"
          table={{
            columns: [
              { key: 'm', label: 'Month', value: (r) => r.label },
              { key: 'a', label: 'All', align: 'right', value: (r) => pct(v.overall[r.i]) },
              { key: 'h', label: 'Hindi', align: 'right', value: (r) => pct(v.bySubject.Hindi[r.i]) },
              { key: 'mm', label: 'Maths', align: 'right', value: (r) => pct(v.bySubject.Maths[r.i]) },
            ],
            rows: data.months.map((m, i) => ({ label: m.label, i })),
          }}
          footer="Apr–Jun come from school percentages, Jul onward from child counts per LO; see Definitions."
        >
          <LineChart
            xs={xs}
            label="Average school result by month, all subjects, Hindi and Maths"
            series={[
              { key: 'all', label: 'All', short: 'All', values: v.overall, color: '#1b2d4f' },
              ...(f.subject ? [] : [
                { key: 'h', label: 'Hindi', values: v.bySubject.Hindi, color: '#2a78d6' },
                { key: 'mt', label: 'Maths', values: v.bySubject.Maths, color: '#eb6834' },
              ]),
            ]}
            marker={formatBreak(data)}
            selectedKey={f.m}
            onSelect={(m) => setFilters({ m })}
            notes={data.months.map((m) => (m.lowCoverage ? `Only ${m.schools} schools` : null))}
          />
        </ChartCard>

        <ChartCard
          title="Schools reporting by month"
          sub="Schools with at least one result under the current filters"
          table={{
            columns: [
              { key: 'm', label: 'Month', value: (r) => r.m.label },
              { key: 's', label: 'Schools', align: 'right', value: (r) => int(r.s.schools) },
              { key: 'n', label: 'Results', align: 'right', value: (r) => int(r.s.n) },
              { key: 'c', label: 'Children', align: 'right', value: (r) => int(r.s.students) },
            ],
            rows: data.months.map((m, i) => ({ m, s: v.schoolsSeries[i] })),
          }}
        >
          <ColumnChart
            label="Schools reporting by month"
            valueFormat={(x) => int(x)}
            selectedKey={f.m}
            onSelect={(m) => setFilters({ m })}
            data={data.months.map((m, i) => ({
              key: m.key,
              label: xs[i].label,
              value: v.schoolsSeries[i].schools,
              muted: m.lowCoverage,
              tip: `${m.label}: ${int(v.schoolsSeries[i].schools)} schools, ${int(v.schoolsSeries[i].n)} results`,
            }))}
          />
        </ChartCard>
      </div>

      <div className="grid-2">
        <ChartCard
          title="How results are spread"
          sub="Share of school × LO results in each score band, by month"
          table={{
            columns: [
              { key: 'm', label: 'Month', value: (r) => r.m.label },
              ...BANDS.map((b) => ({ key: b.key, label: b.label, align: 'right', value: (r) => share(r.s.bands[b.key], r.s.n) })),
              { key: 'n', label: 'Results', align: 'right', value: (r) => int(r.s.n) },
            ],
            rows: data.months.map((m, i) => ({ m, s: v.schoolsSeries[i] })),
          }}
        >
          <StackedShareChart
            label="Share of results in each score band by month"
            xs={xs}
            levels={BANDS.map((b, i) => ({ ...b, ink: i === 0 ? '#fff' : i === 3 ? '#fff' : '#0b0b0b' }))}
            value={(k) => v.schoolsSeries[data.months.findIndex((m) => m.key === k)].bands}
            selectedKey={f.m}
            onSelect={(m) => setFilters({ m })}
          />
        </ChartCard>

        <ChartCard title="Grade and subject over time" sub="Average school result (%) · hover for schools · click a row to filter">
          <Heatmap
            rowHeader=""
            rows={visibleGradeRows.map((r) => ({ ...r, label: r.subject, group: r.group }))}
            cols={data.months.map((m, i) => ({ key: m.key, label: xs[i].label }))}
            cell={(rk, mk) => {
              const s = gradeCells[`${rk}|${mk}`]
              if (!s?.n) return { value: null, text: '·', tip: 'Not assessed' }
              return { value: s.avg, text: `${Math.round(s.avg)}`, tip: `${Math.round(s.avg)}% · ${s.schools} schools, ${s.n} results` }
            }}
            onRowClick={(rk) => {
              const [grade, subject] = rk.split('|')
              setFilters({ grade, subject })
            }}
            legend={{ label: 'Average result', note: '· = not assessed that month' }}
          />
        </ChartCard>
      </div>

      <div className="grid-2">
        <ChartCard
          title={`Blocks · ${month.label}`}
          sub="Average school result · line = district average · click a block to open it"
          table={{
            columns: [
              { key: 'b', label: 'Block', value: (r) => r.block },
              { key: 'a', label: 'Average', align: 'right', value: (r) => pct(r.avg) },
              { key: 's', label: 'Schools', align: 'right', value: (r) => int(r.schools) },
              { key: 'c', label: `Change vs ${pm?.label || '—'}`, align: 'right', value: (r) => signed(r.change) },
            ],
            rows: v.blocks,
          }}
        >
          <BarList
            data={v.blocks.map((b) => ({ key: b.block, label: b.block, value: b.avg, status: scoreStatus(b.avg), sub: `${b.schools} schools`, tip: `${b.block}: ${pct(b.avg)}, ${b.schools} schools` }))}
            reference={cur.avg}
            onSelect={(block) => nav('blocks', null, { ...f, block })}
          />
        </ChartCard>

        <ChartCard
          title={`Learning outcomes to watch · ${month.label}`}
          sub={`Lowest and highest average result, LOs assessed in at least ${MIN_SCHOOLS_FOR_RANKING} schools`}
          table={{
            columns: [
              { key: 'c', label: 'Learning outcome', value: (r) => `G${r.lo.grade} · ${r.lo.label}` },
              { key: 'a', label: 'Average', align: 'right', value: (r) => pct(r.avg) },
              { key: 's', label: 'Schools', align: 'right', value: (r) => int(r.schools) },
            ],
            rows: [...weakest, ...strongest],
          }}
        >
          {v.los.length === 0 ? (
            <div className="empty">No learning outcome was assessed in {MIN_SCHOOLS_FOR_RANKING}+ schools.</div>
          ) : (
            <>
              <div className="mini-title">Lowest</div>
              <BarList
                data={weakest.map((l) => ({ key: l.code, label: `G${l.lo.grade} · ${l.lo.label}`, value: l.avg, status: scoreStatus(l.avg), sub: `${l.schools} schools` }))}
                onSelect={(lo) => nav('competencies', null, { ...f, lo })}
              />
              <div className="mini-title">Highest</div>
              <BarList
                data={strongest.map((l) => ({ key: l.code, label: `G${l.lo.grade} · ${l.lo.label}`, value: l.avg, status: scoreStatus(l.avg), sub: `${l.schools} schools` }))}
                onSelect={(lo) => nav('competencies', null, { ...f, lo })}
              />
            </>
          )}
        </ChartCard>
      </div>
    </>
  )
}
