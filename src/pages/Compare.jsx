import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, LegendSwatch, Scatter, SOURCE } from '../components/charts.jsx'
import { ChartCard, Notice, Select, StatCard } from '../components/ui.jsx'
import { BANDS, groupBy, int, pct } from '../lib/data.js'
import { PARTNER_GRADES, QUARTERS, SUGGESTED_PAIRS, blockKey, fetchPartnerSchools, partnerAverage, partnerFields, partnerLabel } from '../lib/partner.js'
import { PageHead } from './common.jsx'

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const fmtGap = (g) => (g == null ? '—' : `${g > 0 ? '+' : g < 0 ? '−' : '±'}${Math.abs(Math.round(g))} pts`)
const pairKey = (p) => `${p.nipun.join('+')}>${p.partner}`

export default function Compare({ data }) {
  const latestQuarter = QUARTERS.filter((q) => q.months.some((m) => data.results[m])).pop() || QUARTERS[0]
  const [quarter, setQuarter] = useState(latestQuarter.key)
  const [grade, setGrade] = useState('2')
  const [month, setMonth] = useState('')
  const [block, setBlock] = useState('')
  const [pairs, setPairs] = useState(SUGGESTED_PAIRS)
  const [selected, setSelected] = useState(null)
  const [partner, setPartner] = useState({ status: 'loading' })
  const [gradeSizes, setGradeSizes] = useState({})

  const q = QUARTERS.find((x) => x.key === quarter)
  const nipunMonths = data.months.filter((m) => q.months.includes(m.key) && (!month || m.key === month))

  useEffect(() => {
    let live = true
    setPartner({ status: 'loading' })
    fetchPartnerSchools(quarter, grade).then(
      (rows) => live && setPartner({ status: 'ready', rows }),
      (e) => live && setPartner({ status: 'error', error: e.message }),
    )
    return () => {
      live = false
    }
  }, [quarter, grade])

  // How many children each grade has this quarter, for the grade picker.
  useEffect(() => {
    let live = true
    setGradeSizes({})
    PARTNER_GRADES.forEach((g) =>
      fetchPartnerSchools(quarter, g).then(
        (rows) => live && setGradeSizes((s) => ({ ...s, [g]: rows.reduce((a, r) => a + r.totalStudents, 0) })),
        () => {},
      ),
    )
    return () => {
      live = false
    }
  }, [quarter])

  const fields = partnerFields(grade)
  const fieldSet = new Set(fields.map((f) => f.code))
  const active = pairs.filter((p) => fieldSet.has(p.partner))
  const bk = block ? blockKey(block) : null

  const model = useMemo(() => {
    const nResults = nipunMonths.flatMap((m) => data.results[m.key]).filter((r) => !bk || blockKey(r.block) === bk)
    const pRows = partner.status === 'ready' ? partner.rows.filter((s) => !bk || blockKey(s.block) === bk) : []
    const rows = active.map((p) => {
      const codes = new Set(p.nipun)
      const list = nResults.filter((r) => codes.has(r.code))
      const nAvg = mean(list.map((r) => r.pct))
      const pa = partnerAverage(pRows, p.partner)
      const nSchools = new Set(list.map((r) => r.school.udise)).size
      return { pair: p, key: pairKey(p), list, nAvg, nSchools, nResults: list.length, pAvg: pa.avg, pSchools: pa.schools, pStudents: pa.students }
    })
    const nSchools = new Set(nResults.map((r) => r.school.udise))
    const pSchools = new Set(pRows.map((s) => String(s.udise)))
    const overlap = [...pSchools].filter((u) => nSchools.has(u)).length
    return { nResults, pRows, rows, nSchools: nSchools.size, pSchools: pSchools.size, pStudents: pRows.reduce((a, s) => a + s.totalStudents, 0), overlap }
  }, [data, nipunMonths.map((m) => m.key).join(), bk, partner, active.map(pairKey).join()])

  const both = model.rows.filter((r) => r.nAvg != null && r.pAvg != null)
  const sel = model.rows.find((r) => r.key === selected) || both[0] || model.rows[0]
  const higher = both.filter((r) => r.pAvg > r.nAvg).length
  const biggest = [...both].sort((a, b) => Math.abs(b.pAvg - b.nAvg) - Math.abs(a.pAvg - a.nAvg))[0]
  const scopeName = block || 'Basti'
  const nipunPeriod = nipunMonths.length ? nipunMonths.map((m) => m.label).join(' + ') : `no NIPUN+ data in ${q.label}`

  return (
    <>
      <PageHead crumb="Compare with Partner Org" title="NIPUN+ against the Partner Org assessment">
        <span className="pill">
          <LegendSwatch color={SOURCE.nipun.color} shape={SOURCE.nipun.shape} /> NIPUN+ · {nipunPeriod}
        </span>
        <span className="pill pill-partner">
          <LegendSwatch color={SOURCE.partner.color} shape={SOURCE.partner.shape} /> Partner Org · {q.label} · Grade {grade}
        </span>
      </PageHead>

      <Notice>
        <strong>Two different instruments.</strong> A NIPUN+ result is what teachers record in the NIPUN+ app: the share of a school's assessed children who achieved a
        learning outcome. A Partner Org result comes from the programme's own one-to-one assessment of a sample of children: their average score on a competency, as a % of
        the marks. Both are 0–100%, so they can sit on one scale, but a gap shows where the two pictures disagree and are worth checking, not which one is right.
      </Notice>

      <div className="filterbar filterbar-compare" role="group" aria-label="Comparison settings">
        <Select label="Quarter" value={quarter} onChange={(v) => (setQuarter(v), setMonth(''))} options={QUARTERS.map((x) => ({ value: x.key, label: x.label }))} />
        <Select
          label="NIPUN+ months"
          value={month}
          onChange={setMonth}
          placeholder="All months in the quarter"
          options={data.months.filter((m) => q.months.includes(m.key)).map((m) => ({ value: m.key, label: m.label }))}
        />
        <Select
          label="Partner Org grade"
          value={grade}
          onChange={setGrade}
          options={PARTNER_GRADES.map((g) => ({ value: g, label: `Grade ${g}${gradeSizes[g] != null ? ` · ${int(gradeSizes[g])} children` : ''}` }))}
        />
        <Select label="Area" value={block} onChange={setBlock} placeholder="Basti district" options={data.blocks.map((b) => ({ value: b, label: b }))} />
      </div>

      {partner.status === 'error' && (
        <Notice tone="warning">
          Couldn't load the Partner Org data: {partner.error}. Try again in a minute; the backend can be slow right after it rebuilds.
        </Notice>
      )}
      {partner.status === 'loading' && <div className="card empty">Loading the Partner Org assessment for {q.label}, Grade {grade}…</div>}

      {partner.status === 'ready' && (
        <>
          <div className="stats">
            <StatCard label="NIPUN+ schools reporting" value={int(model.nSchools)} sub={`${scopeName} · ${nipunPeriod}`} className="stat-nipun" />
            <StatCard label="Partner Org children assessed" value={int(model.pStudents)} sub={`${int(model.pSchools)} schools · Grade ${grade} · ${quarter}`} className="stat-partner" />
            <StatCard label="Schools in both" value={int(model.overlap)} sub="Same UDISE in both sources" />
            <StatCard
              label="Skills compared"
              value={`${both.length} of ${active.length}`}
              sub={both.length ? `Partner Org higher on ${higher}, NIPUN+ higher on ${both.length - higher}` : 'No skill has data on both sides'}
            />
          </div>

          {model.pStudents === 0 && (
            <Notice tone="warning">
              The Partner Org has no Grade {grade} results in {q.label}
              {block ? ` for ${block}` : ''}. Pick another grade or quarter — the grade picker shows how many children each grade has.
            </Notice>
          )}

          {both.length > 0 && (
            <p className="narrative">
              In {scopeName}, the Partner Org's Grade {grade} assessment ({quarter}) scores <strong>higher than NIPUN+ on {higher}</strong> of the {both.length} skills that have
              data on both sides. The widest gap is <strong>{biggest.pair.skill}</strong>: {pct(biggest.nAvg)} on NIPUN+ against {pct(biggest.pAvg)} from the Partner Org (
              {fmtGap(biggest.pAvg - biggest.nAvg)}).
            </p>
          )}

          <ChartCard
            title="Skill by skill"
            sub={`${scopeName} · NIPUN+ average school result against the Partner Org's average score · click a skill to break it down below`}
            table={{
              columns: [
                { key: 's', label: 'Skill', value: (r) => r.pair.skill },
                { key: 'nc', label: 'NIPUN+ LOs', value: (r) => r.pair.nipun.join(', ') },
                { key: 'n', label: 'NIPUN+', align: 'right', value: (r) => pct(r.nAvg) },
                { key: 'ns', label: 'NIPUN+ schools', align: 'right', value: (r) => int(r.nSchools) },
                { key: 'pc', label: 'Partner competency', value: (r) => partnerLabel(r.pair.partner) },
                { key: 'p', label: 'Partner Org', align: 'right', value: (r) => pct(r.pAvg) },
                { key: 'pst', label: 'Partner children', align: 'right', value: (r) => int(r.pStudents) },
                { key: 'g', label: 'Gap', align: 'right', value: (r) => fmtGap(r.nAvg != null && r.pAvg != null ? r.pAvg - r.nAvg : null) },
              ],
              rows: model.rows,
            }}
          >
            {model.rows.length === 0 ? (
              <div className="empty">None of the chosen skill pairs is assessed by the Partner Org in Grade {grade}. Add a pair below.</div>
            ) : (
              <Dumbbell
                label={`NIPUN+ and Partner Org results by skill, ${scopeName}`}
                selectedKey={sel?.key}
                onSelect={setSelected}
                rows={model.rows.map((r) => ({
                  key: r.key,
                  label: r.pair.skill,
                  sub: `${r.pair.nipun.filter((c) => data.losByCode[c]).join(', ') || r.pair.nipun.join(', ')} · ${partnerLabel(r.pair.partner)}`,
                  a: r.nAvg,
                  b: r.pAvg,
                  tipA: `NIPUN+ ${r.pair.nipun.join(', ')}: ${pct(r.nAvg)} · ${r.nSchools} schools, ${r.nResults} results`,
                  tipB: `Partner Org ${partnerLabel(r.pair.partner)} (Grade ${grade}): ${pct(r.pAvg)} · ${int(r.pStudents)} children in ${r.pSchools} schools`,
                }))}
              />
            )}
          </ChartCard>

          {sel && <PairDetail data={data} sel={sel} model={model} grade={grade} block={block} quarter={quarter} nipunMonths={nipunMonths} />}
        </>
      )}

      <PairEditor data={data} pairs={pairs} setPairs={setPairs} fields={fields} grade={grade} />
    </>
  )
}

function PairDetail({ data, sel, model, grade, block, quarter, nipunMonths }) {
  // Per-school values on each side, for the band split and the same-schools scatter.
  const nSchool = new Map()
  groupBy(sel.list, (r) => r.school.udise).forEach((list, u) => nSchool.set(u, { school: list[0].school, v: mean(list.map((r) => r.pct)) }))
  const pSchool = new Map(model.pRows.filter((s) => typeof s[sel.pair.partner] === 'number').map((s) => [String(s.udise), s]))
  const bandsOf = (vals) => {
    const out = { n: vals.length }
    BANDS.forEach((b) => (out[b.key] = vals.filter(b.test).length))
    return out
  }
  const nb = bandsOf([...nSchool.values()].map((x) => x.v))
  const pb = bandsOf([...pSchool.values()].map((s) => s[sel.pair.partner]))
  const matched = [...pSchool.entries()].filter(([u]) => nSchool.has(u)).map(([u, s]) => ({ u, s, n: nSchool.get(u) }))

  // Blocks: NIPUN+ schools and Partner Org schools grouped by the same block key.
  const nByBlock = groupBy(sel.list, (r) => blockKey(r.block))
  const pByBlock = groupBy(model.pRows, (s) => blockKey(s.block))
  const names = new Map(data.blocks.map((b) => [blockKey(b), b]))
  const blockRows = [...new Set([...nByBlock.keys(), ...pByBlock.keys()])]
    .map((k) => {
      const nl = nByBlock.get(k) || []
      const pa = partnerAverage(pByBlock.get(k) || [], sel.pair.partner)
      return {
        key: k,
        label: names.get(k) || (pByBlock.get(k)?.[0]?.block ?? k),
        a: mean(nl.map((r) => r.pct)),
        b: pa.avg,
        nSchools: new Set(nl.map((r) => r.school.udise)).size,
        pStudents: pa.students,
      }
    })
    .filter((r) => r.a != null || r.b != null)
    .sort((x, y) => (y.a ?? -1) - (x.a ?? -1))

  return (
    <>
      <h2 className="section-title section-gap">
        {sel.pair.skill}: {sel.pair.nipun.join(' / ')} against {partnerLabel(sel.pair.partner)} (Grade {grade})
      </h2>
      <div className="grid-2">
        <ChartCard
          title="Spread of school results"
          sub="Share of schools in each score band, each source on its own bar"
          table={{
            columns: [
              { key: 's', label: 'Source', value: (r) => r.label },
              ...BANDS.map((b) => ({ key: b.key, label: b.label, align: 'right', value: (r) => `${r.b.n ? Math.round((r.b[b.key] / r.b.n) * 100) : 0}% (${r.b[b.key]})` })),
              { key: 'n', label: 'Schools', align: 'right', value: (r) => int(r.b.n) },
            ],
            rows: [
              { label: 'NIPUN+', b: nb },
              { label: 'Partner Org', b: pb },
            ],
          }}
        >
          <BandCompare rows={[{ ...SOURCE.nipun, b: nb }, { ...SOURCE.partner, b: pb }]} />
        </ChartCard>

        <ChartCard
          title="Schools assessed by both"
          sub={`Each dot is a school with ${sel.pair.skill.toLowerCase()} results in both sources · above the line = Partner Org higher`}
          table={
            matched.length
              ? {
                  columns: [
                    { key: 's', label: 'School', value: (r) => r.n.school.name },
                    { key: 'b', label: 'Block', value: (r) => r.n.school.block },
                    { key: 'n', label: 'NIPUN+', align: 'right', value: (r) => pct(r.n.v) },
                    { key: 'p', label: 'Partner Org', align: 'right', value: (r) => pct(r.s[sel.pair.partner]) },
                    { key: 'c', label: 'Partner children', align: 'right', value: (r) => int(r.s.totalStudents) },
                  ],
                  rows: matched,
                }
              : undefined
          }
        >
          {matched.length < 3 ? (
            <div className="empty">
              {matched.length === 0 ? 'No school' : `Only ${matched.length} school${matched.length > 1 ? 's' : ''}`} has {sel.pair.skill.toLowerCase()} results in both NIPUN+ (
              {nipunMonths.map((m) => m.label).join(', ') || '—'}) and the Partner Org ({quarter}, Grade {grade}) — too few to plot.
            </div>
          ) : (
            <Scatter
              label={`School results, NIPUN+ against Partner Org, ${sel.pair.skill}`}
              xLabel="NIPUN+ result"
              yLabel="Partner Org score"
              color={SOURCE.partner.color}
              points={matched.map((m) => ({
                key: m.u,
                label: m.n.school.name,
                x: m.n.v,
                y: m.s[sel.pair.partner],
                tip: `${m.n.school.name} (${m.n.school.block}): NIPUN+ ${pct(m.n.v)}, Partner Org ${pct(m.s[sel.pair.partner])} from ${m.s.totalStudents} children`,
              }))}
            />
          )}
        </ChartCard>
      </div>

      {!block && (
        <ChartCard
          title="Block by block"
          sub={`${sel.pair.skill} · blocks in either source, sorted by NIPUN+ result`}
          table={{
            columns: [
              { key: 'b', label: 'Block', value: (r) => r.label },
              { key: 'n', label: 'NIPUN+', align: 'right', value: (r) => pct(r.a) },
              { key: 'ns', label: 'NIPUN+ schools', align: 'right', value: (r) => int(r.nSchools) },
              { key: 'p', label: 'Partner Org', align: 'right', value: (r) => pct(r.b) },
              { key: 'pc', label: 'Partner children', align: 'right', value: (r) => int(r.pStudents) },
              { key: 'g', label: 'Gap', align: 'right', value: (r) => fmtGap(r.a != null && r.b != null ? r.b - r.a : null) },
            ],
            rows: blockRows,
          }}
        >
          <Dumbbell
            label={`${sel.pair.skill} by block, NIPUN+ and Partner Org`}
            rows={blockRows.map((r) => ({
              ...r,
              sub: `${r.nSchools} NIPUN+ schools · ${int(r.pStudents)} Partner children`,
              tipA: `NIPUN+: ${pct(r.a)} across ${r.nSchools} schools`,
              tipB: `Partner Org: ${pct(r.b)} from ${int(r.pStudents)} children`,
            }))}
          />
        </ChartCard>
      )}
    </>
  )
}

// Two 100% bars, one per source, in the shared score-band colours with labels on the segments.
function BandCompare({ rows }) {
  return (
    <div className="bandcmp">
      <div className="legend">
        {BANDS.map((b) => (
          <span key={b.key} className="legend-item">
            <span className="legend-swatch" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="bandcmp-row">
          <div className="bandcmp-label">
            <LegendSwatch color={r.color} shape={r.shape} /> {r.label}
            <span className="muted small"> · {int(r.b.n)} schools</span>
          </div>
          <div className="bandcmp-bar" role="img" aria-label={`${r.label}: ${BANDS.map((b) => `${b.label} ${r.b.n ? Math.round((r.b[b.key] / r.b.n) * 100) : 0}%`).join(', ')}`}>
            {r.b.n === 0 && <span className="muted small">No schools</span>}
            {BANDS.map((b, i) => {
              const p = r.b.n ? (r.b[b.key] / r.b.n) * 100 : 0
              return p > 0 ? (
                <span key={b.key} style={{ width: `${p}%`, background: b.color, color: i === 0 || i === 3 ? '#fff' : '#0b0b0b' }} title={`${b.label}: ${Math.round(p)}% (${r.b[b.key]})`}>
                  {p >= 8 ? `${Math.round(p)}%` : ''}
                </span>
              ) : null
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function PairEditor({ data, pairs, setPairs, fields, grade }) {
  const [lo, setLo] = useState('')
  const [field, setField] = useState('')
  const add = () => {
    if (!lo || !field) return
    const l = data.losByCode[lo]
    setPairs([...pairs, { skill: `${l.desc || l.code} ↔ ${partnerLabel(field)}`, nipun: [lo], partner: field }])
    setLo('')
    setField('')
  }
  const fieldSet = new Set(fields.map((f) => f.code))
  return (
    <details className="card pair-editor">
      <summary>
        <span className="card-title">Skill pairs</span>
        <span className="card-sub"> · which NIPUN+ learning outcomes are compared with which Partner Org competency ({pairs.length} pairs)</span>
      </summary>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">NIPUN+ learning outcomes</th>
            <th scope="col">Partner Org competency</th>
            <th scope="col">In Grade {grade}?</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={pairKey(p) + i}>
              <td>{p.skill}</td>
              <td>{p.nipun.map((c) => data.losByCode[c]?.label || `${c} (no data)`).join(' · ')}</td>
              <td>{partnerLabel(p.partner)}</td>
              <td>{fieldSet.has(p.partner) ? 'Yes' : <span className="muted">Not assessed</span>}</td>
              <td className="num">
                <button className="btn btn-small" onClick={() => setPairs(pairs.filter((_, j) => j !== i))} aria-label={`Remove ${p.skill}`}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toolbar pair-add">
        <Select label="NIPUN+ learning outcome" value={lo} onChange={setLo} placeholder="Choose…" options={data.los.map((l) => ({ value: l.code, label: `G${l.grade} · ${l.label}` }))} />
        <Select label={`Partner Org competency (Grade ${grade})`} value={field} onChange={setField} placeholder="Choose…" options={fields.map((f) => ({ value: f.code, label: `${f.subject} · ${f.label}` }))} />
        <button className="btn" onClick={add} disabled={!lo || !field}>
          Add pair
        </button>
        <button className="btn btn-ghost" onClick={() => setPairs(SUGGESTED_PAIRS)}>
          Reset to suggested pairs
        </button>
      </div>
    </details>
  )
}
