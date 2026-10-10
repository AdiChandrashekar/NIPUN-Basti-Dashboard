import { useEffect, useMemo, useState } from 'react'
import { LegendSwatch, SOURCE } from '../components/charts.jsx'
import { AgreementMatrix, AgreementScatter, CAT_STYLE, CatSwatch, CoverageBar, DotCompare } from '../components/compareCharts.jsx'
import { ChartCard, DataTable, Notice } from '../components/ui.jsx'
import { BANDS3, CATEGORY, MIN_EVIDENCE, compareSubject } from '../lib/compare.js'
import { SUBJECTS, int, pct } from '../lib/data.js'
import { PARTNER_GRADES, QUARTERS, fetchPartnerSchools } from '../lib/partner.js'
import { PageHead } from './common.jsx'

const fmtGap = (g) => (g == null ? '—' : `${g > 0 ? '+' : g < 0 ? '−' : '±'}${Math.abs(Math.round(g))} pts`)
const SUBJECT_NAME = { Hindi: 'Hindi (literacy)', Maths: 'Maths (numeracy)' }

export default function Compare({ data, nav }) {
  const quarters = QUARTERS.filter((q) => q.months.some((m) => data.results[m]))
  const [quarter, setQuarter] = useState(quarters[quarters.length - 1].key)
  const [grade, setGrade] = useState(null)
  const [subject, setSubject] = useState('Hindi')
  const [onlyEnough, setOnlyEnough] = useState(true)
  const [cell, setCell] = useState(null) // selected matrix cell "nb-pb"
  const [cat, setCat] = useState('') // school list filter
  const [partner, setPartner] = useState({ status: 'loading' })

  const q = QUARTERS.find((x) => x.key === quarter)
  const monthKeys = data.months.filter((m) => q.months.includes(m.key)).map((m) => m.key)
  const monthLabel = data.months
    .filter((m) => monthKeys.includes(m.key))
    .map((m) => m.label.split(' ')[0])
    .join(' + ')

  // All three Partner Org grades for the quarter: needed to know which grades can be compared.
  useEffect(() => {
    let live = true
    setPartner({ status: 'loading' })
    Promise.all(PARTNER_GRADES.map((g) => fetchPartnerSchools(quarter, g))).then(
      (rows) => live && setPartner({ status: 'ready', byGrade: Object.fromEntries(PARTNER_GRADES.map((g, i) => [g, rows[i]])) }),
      (e) => live && setPartner({ status: 'error', error: e.message }),
    )
    return () => {
      live = false
    }
  }, [quarter])

  const grades = useMemo(() => {
    if (partner.status !== 'ready') return []
    return PARTNER_GRADES.map((g) => ({
      g,
      children: partner.byGrade[g].reduce((t, s) => t + s.totalStudents, 0),
      nipun: monthKeys.some((mk) => data.results[mk].some((r) => r.grade === g)),
    }))
  }, [partner, quarter])
  const usable = grades.filter((x) => x.children > 0 && x.nipun)
  const activeGrade = usable.some((x) => x.g === grade) ? grade : [...usable].sort((a, b) => b.children - a.children)[0]?.g

  const bySubject = useMemo(() => {
    if (partner.status !== 'ready' || !activeGrade) return null
    return Object.fromEntries(SUBJECTS.map((s) => [s, compareSubject(data, partner.byGrade[activeGrade], monthKeys, activeGrade, s, { onlyEnough })]))
  }, [data, partner, activeGrade, quarter, onlyEnough])

  const reset = () => (setCell(null), setCat(''))
  const cur = bySubject?.[subject]

  return (
    <>
      <PageHead crumb="Compare with Partner Org" title="Does NIPUN+ agree with the Partner Org assessment?" />
      <p className="lede">
        Teachers record NIPUN+ results in the NIPUN+ app; the Partner Org assesses children itself, one to one. Where both looked at the same school, in the same
        grade and the same months, their results should tell a similar story. This page shows where they do and where they don't.
      </p>

      <div className="cmp-controls card" role="group" aria-label="What to compare">
        <Segmented
          label="Period"
          value={quarter}
          onChange={(v) => (setQuarter(v), reset())}
          options={quarters.map((x) => ({ value: x.key, label: x.label, sub: x.key }))}
        />
        <Segmented
          label="Grade"
          value={activeGrade}
          onChange={(v) => (setGrade(v), reset())}
          options={(grades.length ? grades : PARTNER_GRADES.map((g) => ({ g, children: null, nipun: true }))).map((x) => ({
            value: x.g,
            label: `Grade ${x.g}`,
            sub: x.children == null ? '…' : !x.nipun ? 'no NIPUN+ data' : x.children ? `${int(x.children)} children` : 'not assessed',
            disabled: x.children === 0 || !x.nipun,
          }))}
        />
        <Segmented label="Subject" value={subject} onChange={(v) => (setSubject(v), reset())} options={SUBJECTS.map((s) => ({ value: s, label: s, sub: s === 'Hindi' ? 'literacy' : 'numeracy' }))} />
        <Segmented
          label="Schools"
          value={onlyEnough ? 'enough' : 'all'}
          onChange={(v) => (setOnlyEnough(v === 'enough'), reset())}
          options={[
            { value: 'enough', label: 'Enough data', sub: `${MIN_EVIDENCE}+ checks & ${MIN_EVIDENCE}+ children` },
            { value: 'all', label: 'All in both', sub: 'including tiny samples' },
          ]}
        />
      </div>

      {partner.status === 'loading' && <div className="card empty">Loading the Partner Org assessment for {q.label}…</div>}
      {partner.status === 'error' && <Notice tone="warning">Couldn't load the Partner Org data: {partner.error}. Try again in a minute.</Notice>}
      {partner.status === 'ready' && !activeGrade && (
        <Notice tone="warning">
          No grade has results in both sources for {q.label}. The Partner Org assessed{' '}
          {grades.filter((x) => x.children).map((x) => `Grade ${x.g}`).join(', ') || 'no children'}.
        </Notice>
      )}

      {cur && (
        <>
          <Headline data={bySubject} subject={subject} setSubject={(s) => (setSubject(s), reset())} grade={activeGrade} period={`${monthLabel} ${q.label.slice(-4)}`} />

          <div className="grid-2">
            <ChartCard
              title="Do they place schools in the same band?"
              sub={`${int(cur.matched.length)} schools compared · Grade ${activeGrade} ${subject} · click a cell to list those schools`}
              table={{
                columns: [
                  { key: 'n', label: 'NIPUN+ band', value: (r) => r.nb.label },
                  ...BANDS3.map((pb) => ({ key: `p${pb.key}`, label: `Partner ${pb.label}`, align: 'right', value: (r) => int(cur.matrix[r.nb.key][pb.key]) })),
                ],
                rows: [...BANDS3].reverse().map((nb) => ({ nb })),
              }}
              footer={
                <>
                  Bands use the dashboard's usual cut-offs: below 50%, 50–74%, 75% or more. {cur.agree} schools ({pct((cur.agree / (cur.matched.length || 1)) * 100)}) are in
                  the same band in both.
                </>
              }
            >
              <AgreementMatrix
                matrix={cur.matrix}
                selected={cell}
                onSelect={(k) => (setCell(k), setCat(''), k && document.getElementById('cmp-schools')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
              />
            </ChartCard>

            <ChartCard
              title="Every school assessed by both"
              sub="Each mark is a school · shaded squares = same band in both · above the diagonal, NIPUN+ is higher"
            >
              <CatLegend />
              <AgreementScatter
                label={`Schools: NIPUN+ against Partner Org, Grade ${activeGrade} ${subject}`}
                highlight={cell ? (p) => p.cell === cell : cat ? (p) => p.cat === cat : null}
                points={cur.matched.map((m) => ({
                  key: m.udise,
                  x: m.p.value,
                  y: m.n.value,
                  cat: m.cat,
                  cell: `${m.nb}-${m.pb}`,
                  tip: (
                    <>
                      <b>{m.n.school.name}</b>
                      <div>{m.n.school.block}</div>
                      <div>
                        NIPUN+ {pct(m.n.value)} {m.n.counted ? `(${m.n.a} of ${m.n.n} checks)` : `(${m.n.los.size} LOs)`}
                      </div>
                      <div>
                        Partner Org {pct(m.p.value)} ({m.p.students} children)
                      </div>
                      <div>Gap {fmtGap(m.gap)}</div>
                    </>
                  ),
                }))}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Block by block"
            sub={`Same schools only · Grade ${activeGrade} ${subject} · sorted by gap, NIPUN+ most above the Partner Org first`}
            table={{
              columns: [
                { key: 'b', label: 'Block', value: (r) => r.label },
                { key: 's', label: 'Schools in both', align: 'right', value: (r) => int(r.schools) },
                { key: 'n', label: 'NIPUN+', align: 'right', value: (r) => pct(r.nipun) },
                { key: 'p', label: 'Partner Org', align: 'right', value: (r) => pct(r.partner) },
                { key: 'c', label: 'Partner children', align: 'right', value: (r) => int(r.children) },
                { key: 'g', label: 'Gap', align: 'right', value: (r) => fmtGap(r.nipun - r.partner) },
              ],
              rows: [...cur.blocks].sort((a, b) => b.nipun - b.partner - (a.nipun - a.partner)),
            }}
          >
            {cur.blocks.length === 0 ? (
              <div className="empty">No school was assessed by both.</div>
            ) : (
              <DotCompare
                label={`Blocks: NIPUN+ and Partner Org, Grade ${activeGrade} ${subject}`}
                rows={[...cur.blocks]
                  .sort((a, b) => b.nipun - b.partner - (a.nipun - a.partner))
                  .map((b) => ({
                    key: b.key,
                    label: b.label,
                    sub: `${b.schools} school${b.schools > 1 ? 's' : ''}, ${int(b.children)} children${b.schools < 3 ? ' (few)' : ''}`,
                    nipun: b.nipun,
                    partner: b.partner,
                    tipNipun: `NIPUN+ ${pct(b.nipun)} in ${b.schools} schools`,
                    tipPartner: `Partner Org ${pct(b.partner)} from ${int(b.children)} children`,
                  }))}
              />
            )}
          </ChartCard>

          <SchoolList cur={cur} cell={cell} setCell={setCell} cat={cat} setCat={setCat} nav={nav} grade={activeGrade} subject={subject} quarter={quarter} />

          <Method grade={activeGrade} q={q} monthLabel={monthLabel} />
        </>
      )}
    </>
  )
}

function Segmented({ label, value, onChange, options }) {
  return (
    <div className="seg-field">
      <span className="field-label" id={`seg-${label}`}>
        {label}
      </span>
      <div className="seg" role="radiogroup" aria-labelledby={`seg-${label}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`seg-btn${value === o.value ? ' active' : ''}`}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
          >
            <span className="seg-label">{o.label}</span>
            {o.sub && <span className="seg-sub">{o.sub}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Headline({ data, subject, setSubject, grade, period }) {
  return (
    <div className="cmp-headline">
      {SUBJECTS.map((s) => {
        const d = data[s]
        const n = d.matched.length
        const gap = d.nipun != null && d.partner != null ? d.nipun - d.partner : null
        const higher = gap == null || Math.abs(gap) < 0.5 ? null : gap > 0 ? SOURCE.nipun : SOURCE.partner
        return (
          <div key={s} className={`cmp-subject${s === subject ? ' active' : ''}`} onClick={() => setSubject(s)}>
            <div className="cmp-subject-head">
              <span className="stat-label">
                Grade {grade} {SUBJECT_NAME[s]}
              </span>
              <span className="muted small">
                {period} · {int(n)} schools compared
              </span>
            </div>
            {n === 0 ? (
              <div className="empty">No school assessed by both.</div>
            ) : (
              <>
                <div className="cmp-pair">
                  <div className="cmp-val">
                    <span className="cmp-src">
                      <LegendSwatch color={SOURCE.nipun.color} shape={SOURCE.nipun.shape} /> NIPUN+
                    </span>
                    <span className="cmp-num" style={{ color: SOURCE.nipun.ink }}>
                      {pct(d.nipun)}
                    </span>
                    <span className="cmp-note">{d.counted ? `${int(d.checks)} child × LO checks` : 'mean of school results'}</span>
                  </div>
                  <div className="cmp-val">
                    <span className="cmp-src">
                      <LegendSwatch color={SOURCE.partner.color} shape={SOURCE.partner.shape} /> Partner Org
                    </span>
                    <span className="cmp-num" style={{ color: SOURCE.partner.ink }}>
                      {pct(d.partner)}
                    </span>
                    <span className="cmp-note">{int(d.children)} children</span>
                  </div>
                </div>
                <div className="cmp-verdict">
                  {higher ? (
                    <>
                      <strong style={{ color: higher.ink }}>
                        {higher.label} {Math.abs(Math.round(gap))} pts higher
                      </strong>{' '}
                      in the same schools.
                    </>
                  ) : (
                    <strong>Level in the same schools.</strong>
                  )}{' '}
                  Same band in {pct((d.agree / n) * 100)} of schools; NIPUN+ higher in {pct((d.nipunHigher / n) * 100)}, Partner Org higher in{' '}
                  {pct((d.partnerHigher / n) * 100)}.
                </div>
                <AgreeStrip d={d} />
              </>
            )}
          </div>
        )
      })}
      <div className="cmp-coverage card">
        <div className="card-title">Who was assessed · Grade {grade} {subject}</div>
        <div className="card-sub">
          Schools with results in each source. Only schools in both are compared on this page
          {data[subject].excluded > 0 &&
            `; ${data[subject].excluded} of the ${data[subject].coverage.both} are left out because one side has fewer than ${MIN_EVIDENCE} checks or children (switch Schools to "All in both" to include them)`}
          .
        </div>
        <CoverageBar {...data[subject].coverage} />
      </div>
    </div>
  )
}

// A thin 100% bar: share of matched schools NIPUN+ higher / same band / Partner higher.
function AgreeStrip({ d }) {
  const n = d.matched.length || 1
  const segs = [
    ['nipun', d.nipunHigher],
    ['agree', d.agree],
    ['partner', d.partnerHigher],
  ]
  return (
    <span className="agree-strip" aria-hidden>
      {segs.map(([c, v]) => (v ? <span key={c} style={{ width: `${(v / n) * 100}%`, background: CAT_STYLE[c].color }} /> : null))}
    </span>
  )
}

function CatLegend() {
  return (
    <span className="cat-legend">
      {['nipun', 'agree', 'partner'].map((c) => (
        <span key={c} className="legend-item">
          <CatSwatch cat={c} /> {CATEGORY[c].label}
        </span>
      ))}
    </span>
  )
}

function SchoolList({ cur, cell, setCell, cat, setCat, nav, grade, subject, quarter }) {
  const [nb, pb] = cell ? cell.split('-').map(Number) : []
  const rows = cur.matched.filter((m) => (cell ? m.nb === nb && m.pb === pb : !cat || m.cat === cat))
  const chips = [
    { key: '', label: 'All', n: cur.matched.length },
    { key: 'nipun', label: CATEGORY.nipun.label, n: cur.nipunHigher },
    { key: 'agree', label: CATEGORY.agree.label, n: cur.agree },
    { key: 'partner', label: CATEGORY.partner.label, n: cur.partnerHigher },
  ]
  return (
    <section className="section" id="cmp-schools">
      <div className="section-head">
        <div>
          <h2 className="section-title">Schools to look at</h2>
          <div className="section-sub">
            Sorted by gap, NIPUN+ most above the Partner Org first. Where NIPUN+ is far higher, the school's NIPUN+ records may be worth checking on the next visit.
          </div>
        </div>
      </div>
      <div className="chip-filter" role="radiogroup" aria-label="Show schools">
        {chips.map((c) => (
          <button
            key={c.key || 'all'}
            type="button"
            role="radio"
            aria-checked={!cell && cat === c.key}
            className={`chip-btn${!cell && cat === c.key ? ' active' : ''}`}
            onClick={() => (setCell(null), setCat(c.key))}
          >
            {c.key && <CatSwatch cat={c.key} />} {c.label} <span className="muted">{c.n}</span>
          </button>
        ))}
        {cell && (
          <span className="chip-btn active chip-cell">
            NIPUN+ {BANDS3[nb].label} · Partner Org {BANDS3[pb].label}
            <button type="button" className="chip-x" onClick={() => setCell(null)} aria-label="Clear the matrix selection">
              ✕
            </button>
          </span>
        )}
      </div>
      <DataTable
        csvName={`nipunplus-vs-partner-${quarter}-grade${grade}-${subject}.csv`}
        rows={rows}
        initialSort={{ key: 'gap', dir: 'desc' }}
        searchText={(m) => `${m.n.school.name} ${m.n.school.block} ${m.udise}`}
        onRowClick={(m) => nav('schools', m.udise)}
        empty="No schools in this group."
        columns={[
          { key: 'name', label: 'School', value: (m) => m.n.school.name, render: (m) => <span className="link">{m.n.school.name}</span> },
          { key: 'block', label: 'Block', value: (m) => m.n.school.block },
          { key: 'nv', label: 'NIPUN+', align: 'right', value: (m) => m.n.value, render: (m) => <b style={{ color: SOURCE.nipun.ink }}>{pct(m.n.value)}</b>, csv: (m) => m.n.value.toFixed(1) },
          {
            key: 'ne',
            label: 'NIPUN+ basis',
            value: (m) => (m.n.counted ? m.n.n : m.n.los.size),
            render: (m) => <span className="muted">{m.n.counted ? `${m.n.a} / ${m.n.n} check${m.n.n === 1 ? '' : 's'}` : `${m.n.los.size} LOs`}</span>,
            csv: (m) => (m.n.counted ? `${m.n.a}/${m.n.n}` : `${m.n.los.size} LOs`),
          },
          { key: 'pv', label: 'Partner Org', align: 'right', value: (m) => m.p.value, render: (m) => <b style={{ color: SOURCE.partner.ink }}>{pct(m.p.value)}</b>, csv: (m) => m.p.value.toFixed(1) },
          {
            key: 'pc',
            label: 'Partner children',
            align: 'right',
            value: (m) => m.p.students,
            render: (m) => (
              <span>
                {m.p.students}
                {m.p.students < MIN_EVIDENCE && <span className="muted small"> · few</span>}
              </span>
            ),
          },
          { key: 'gap', label: 'Gap', align: 'right', value: (m) => m.gap, render: (m) => <span style={{ color: CAT_STYLE[m.cat].ink, fontWeight: 600 }}>{fmtGap(m.gap)}</span>, csv: (m) => m.gap.toFixed(1) },
          {
            key: 'cat',
            label: 'Bands',
            value: (m) => CATEGORY[m.cat].label,
            render: (m) => (
              <span className="cat-cell">
                <CatSwatch cat={m.cat} /> {CATEGORY[m.cat].label}
              </span>
            ),
          },
        ]}
      />
    </section>
  )
}

function Method({ grade, q, monthLabel }) {
  return (
    <details className="card method">
      <summary>
        <span className="card-title">How this comparison works</span>
      </summary>
      <dl className="prose-dl">
        <dt>One measure on both sides</dt>
        <dd>
          <strong>NIPUN+:</strong> of all the times a Grade {grade} child was checked on a learning outcome in the subject, the share where the child achieved it
          (children achieved ÷ children assessed, added up over the subject's LOs and the months). Before July 2026 the exports only hold school percentages, so
          there it is the average of the school's LO percentages.
          <br />
          <strong>Partner Org:</strong> each child's share of the subject's competencies passed (75% or more of the marks), averaged over the school's children. Larger
          schools count for more in block and district figures.
        </dd>
        <dt>Same grade, same period, same schools</dt>
        <dd>
          NIPUN+ results for Grade {grade} children ({monthLabel || 'no months yet'}) against the Partner Org's Grade {grade} assessment for {q.label}. For Jul–Sep that is
          the Partner Org's first cycle (July–August). Every number that compares the two uses only schools with results in both, matched by UDISE code.
        </dd>
        <dt>Why not skill by skill</dt>
        <dd>
          The NIPUN+ exports don't name most of their learning outcomes, so they can't be matched reliably to the Partner Org's competencies, and NIPUN+ often checks a
          skill in a different grade. The Partner Org's per-competency figures are also average marks rather than pass rates. Comparing whole subjects avoids both
          problems.
        </dd>
        <dt>Reading a gap</dt>
        <dd>
          The two are different instruments: teachers recording in an app against a one-to-one assessment of a few children, often a handful per school. A school where
          NIPUN+ is far above the Partner Org is worth a look, not proof of a problem — especially on small samples. By default the page only compares schools with at least {MIN_EVIDENCE} NIPUN+ checks and {MIN_EVIDENCE} Partner Org
          children; "All in both" adds the rest.
        </dd>
      </dl>
    </details>
  )
}
