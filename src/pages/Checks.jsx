import { useEffect, useMemo, useState } from 'react'
import { LineChart } from '../components/charts.jsx'
import { MiniHistogram, ValidationScatter } from '../components/checkCharts.jsx'
import { ChartCard, DataTable, MiniTable, Notice, Select, StatCard } from '../components/ui.jsx'
import { CSF_GAP, LINES, MIN_RESULTS, SIGNAL, SIGNALS, TIERS, screenSchools, validation } from '../lib/checks.js'
import { int, pct } from '../lib/data.js'
import { PARTNER_GRADES, QUARTERS, fetchPartnerSchools } from '../lib/partner.js'
import { PageHead, formatBreak, monthXs } from './common.jsx'

const TIER_RANK = { strong: 3, watch: 2, single: 1 }
const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b)
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null
}
const fmtPts = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))} pts`)

export default function Checks({ data, nav }) {
  const [csf, setCsf] = useState({ status: 'loading' })
  const [tier, setTier] = useState('flagged') // 'flagged' | 'strong' | 'watch' | 'single'
  const [signal, setSignal] = useState('')
  const [block, setBlock] = useState('')
  const [onlyPersistent, setOnlyPersistent] = useState(false)
  const [selected, setSelected] = useState(null)

  // CSF results for every quarter with NIPUN+ data, every grade.
  useEffect(() => {
    let live = true
    const quarters = QUARTERS.filter((q) => q.months.some((m) => data.results[m]))
    Promise.all(quarters.flatMap((q) => PARTNER_GRADES.map((g) => fetchPartnerSchools(q.key, g).then((rows) => [q.key, g, rows])))).then(
      (list) => {
        if (!live) return
        const byQuarter = {}
        list.forEach(([q, g, rows]) => ((byQuarter[q] ||= {})[g] = rows))
        setCsf({ status: 'ready', byQuarter })
      },
      (e) => live && setCsf({ status: 'error', error: e.message }),
    )
    return () => {
      live = false
    }
  }, [data])

  const schools = useMemo(() => screenSchools(data, csf.status === 'ready' ? csf.byQuarter : null), [data, csf])
  const screened = schools.filter((s) => s.enough)
  const typical = useMemo(() => {
    const out = {}
    for (const sig of SIGNALS) {
      const vals = (sig.key === 'csf' ? schools.filter((s) => s.comps.length) : screened).map((s) => s.metrics[sig.key]).filter((v) => v != null)
      out[sig.key] = { median: median(vals), values: vals, flagged: schools.filter((s) => s.flags.includes(sig.key)).length }
    }
    return out
  }, [schools])
  const val = useMemo(() => validation(schools), [schools])

  const flagged = schools.filter((s) => s.tier)
  const rows = flagged
    .filter((s) => (tier === 'flagged' ? true : s.tier === tier))
    .filter((s) => !signal || s.flags.includes(signal))
    .filter((s) => !block || s.school.block === block)
    .filter((s) => !onlyPersistent || s.persistent)
  const sel = selected ? schools.find((s) => s.udise === selected) : null
  const count = (t) => flagged.filter((s) => s.tier === t).length

  return (
    <>
      <PageHead crumb={<a href="#/schools" onClick={(e) => (e.preventDefault(), nav('schools'))}>Schools</a>} title="Schools with suspicious NIPUN+ results" />
      <p className="lede">
        Which schools may be reporting inflated NIPUN+ results? Six checks look only at the NIPUN+ data — each result against what the rest of Basti reports for the same
        learning outcome in the same month — and a seventh compares the school with CSF's own assessment. Each check flags roughly the most unusual 5% of schools.
      </p>
      <Notice tone="warning">
        <strong>Signals, not proof.</strong> A strong school can trip a check, and small samples swing. Use this list to choose where to look closely on the next visit, not to
        judge a school.
      </Notice>

      {csf.status === 'loading' && <Notice>Loading CSF's assessments to add the independent check… the NIPUN+ checks below are already complete.</Notice>}
      {csf.status === 'error' && <Notice tone="warning">Couldn't load CSF's data ({csf.error}), so only the six NIPUN+ checks are shown.</Notice>}

      <div className="stats">
        <StatCard label="Schools screened" value={int(screened.length)} sub={`${MIN_RESULTS}+ results across ${data.months.length} months`} />
        <StatCard label="Strong" value={int(count('strong'))} status={count('strong') ? 'critical' : 'neutral'} statusText="Look first" sub={TIERS.strong.long} onClick={() => setTier('strong')} />
        <StatCard label="Watch" value={int(count('watch'))} sub={TIERS.watch.long} onClick={() => setTier('watch')} />
        <StatCard label="Persistent" value={int(schools.filter((s) => s.persistent).length)} sub="15+ pts above Basti in every month reported (2+ months)" onClick={() => setOnlyPersistent(true)} />
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="section-title">The seven checks</h2>
            <div className="section-sub">Each chart shows every screened school; red bars are past the threshold. Click a check to list only its schools.</div>
          </div>
        </div>
        <div className="signal-grid">
          {SIGNALS.map((sig) => {
            const t = typical[sig.key]
            const active = signal === sig.key
            const isCount = sig.key === 'wholeclass'
            return (
              <button key={sig.key} type="button" className={`signal-card${active ? ' active' : ''}`} aria-pressed={active} onClick={() => setSignal(active ? '' : sig.key)}>
                <div className="signal-head">
                  <span className={`signal-src src-${sig.source}`}>{sig.source === 'csf' ? 'CSF check' : 'NIPUN+ check'}</span>
                  <span className="signal-count">
                    <b>{t.flagged}</b> school{t.flagged === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="signal-title">{sig.label}</div>
                <div className="signal-rule">{sig.rule}</div>
                {t.values.length > 0 ? (
                  isCount ? (
                    <div className="signal-counts">
                      {[0, 1, 2, 3].map((k) => {
                        const c = t.values.filter((v) => (k === 3 ? v >= 3 : v === k)).length
                        return (
                          <span key={k} className={k >= sig.threshold ? 'flag' : ''}>
                            <b>{int(c)}</b> {k === 3 ? '3+' : k} LO{k === 1 ? '' : 's'}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <MiniHistogram
                      values={t.values}
                      threshold={sig.threshold}
                      min={sig.key === 'excess' ? -60 : sig.key === 'jump' ? -60 : sig.key === 'csf' ? -75 : 0}
                      max={sig.key === 'excess' ? 60 : sig.key === 'jump' ? 80 : sig.key === 'csf' ? 100 : 1}
                      fmt={sig.fmt}
                      label={`${sig.label}: distribution across schools`}
                    />
                  )
                ) : (
                  <div className="muted small">{sig.key === 'csf' && csf.status !== 'ready' ? 'Waiting for CSF data…' : 'No data'}</div>
                )}
                <div className="signal-typical">
                  Typical Basti school: <b>{t.median == null ? '—' : sig.fmt(t.median)}</b>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {val.n > 0 && (
        <div className="grid-2">
          <ChartCard
            title="Do the NIPUN+ checks agree with CSF?"
            sub={`${val.n} schools that CSF also assessed · red = flagged by at least one NIPUN+ check · click a dot for details`}
            table={{
              columns: [
                { key: 'g', label: 'Group', value: (r) => r.label },
                { key: 'n', label: 'Schools', align: 'right', value: (r) => int(r.n) },
                { key: 'gap', label: 'Average pts above CSF', align: 'right', value: (r) => fmtPts(r.gap) },
              ],
              rows: [
                { label: 'Flagged by a NIPUN+ check', ...val.flagged },
                { label: 'Not flagged', ...val.clean },
              ],
            }}
          >
            <ValidationScatter
              xRef={SIGNAL.excess.threshold}
              yRef={CSF_GAP}
              onSelect={setSelected}
              points={val.points.map((p) => ({
                key: p.s.udise,
                x: p.x,
                y: p.y,
                flagged: p.s.flags.some((k) => k !== 'csf'),
                tip: (
                  <>
                    <b>{p.s.school.name}</b>
                    <div>{p.s.school.block}</div>
                    <div>{fmtPts(p.x)} above Basti on NIPUN+</div>
                    <div>{fmtPts(p.y)} above CSF on average</div>
                  </>
                ),
              }))}
            />
          </ChartCard>
          <div className="card validation-card">
            <h2 className="card-title">What this tells us</h2>
            <div className="card-sub">Among schools both sources assessed</div>
            <div className="val-bars">
              {[
                { label: 'Flagged by a NIPUN+ check', d: val.flagged, cls: 'flag' },
                { label: 'Not flagged', d: val.clean, cls: '' },
              ].map((r) => (
                <div key={r.label} className="val-row">
                  <div className="val-label">
                    {r.label} <span className="muted">· {r.d.n} schools</span>
                  </div>
                  <div className="val-track">
                    <span className={`val-fill ${r.cls}`} style={{ width: `${Math.max(2, Math.min(100, ((r.d.gap ?? 0) / 50) * 100))}%` }} />
                    <span className="val-num">{fmtPts(r.d.gap)}</span>
                  </div>
                </div>
              ))}
              <div className="val-axis">
                <span>0</span>
                <span>average pts above CSF</span>
                <span>+50</span>
              </div>
            </div>
            <p className="small">
              {val.flagged.n && val.clean.n && val.flagged.gap > val.clean.gap ? (
                <>
                  Schools the NIPUN+ checks pick out are on average <strong>{fmtPts(val.flagged.gap)}</strong> above CSF's assessment, against{' '}
                  <strong>{fmtPts(val.clean.gap)}</strong> for the rest. The checks, which never look at CSF's data, point at the same schools CSF's independent assessment does
                  — so they are worth using for the {int(screened.length - val.n)} screened schools CSF hasn't assessed.
                </>
              ) : (
                <>Among these schools the NIPUN+ checks don't line up with CSF's assessment, so read them with extra care.</>
              )}
            </p>
          </div>
        </div>
      )}

      <section className="section" id="checks-list">
        <div className="section-head">
          <div>
            <h2 className="section-title">Schools to look at</h2>
            <div className="section-sub">Strongest first. Click a school to see the evidence behind each signal.</div>
          </div>
        </div>
        <div className="toolbar">
          <div className="chip-filter" role="radiogroup" aria-label="Tier">
            {[
              { key: 'flagged', label: 'All flagged', n: flagged.length },
              { key: 'strong', label: 'Strong', n: count('strong') },
              { key: 'watch', label: 'Watch', n: count('watch') },
              { key: 'single', label: 'One line', n: count('single') },
            ].map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={tier === c.key} className={`chip-btn${tier === c.key ? ' active' : ''}`} onClick={() => setTier(c.key)}>
                {c.key !== 'flagged' && <span className={`tier-dot tier-${c.key}`} aria-hidden />} {c.label} <span className="muted">{c.n}</span>
              </button>
            ))}
          </div>
          <Select label="Block" value={block} onChange={setBlock} placeholder="All blocks" options={data.blocks.map((b) => ({ value: b, label: b }))} />
          <Select label="Check" value={signal} onChange={setSignal} placeholder="Any check" options={SIGNALS.map((s) => ({ value: s.key, label: s.label }))} />
          <label className={`toggle${onlyPersistent ? ' on' : ''}`}>
            <input type="checkbox" checked={onlyPersistent} onChange={(e) => setOnlyPersistent(e.target.checked)} />
            <span className="toggle-track" aria-hidden>
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">Persistent only</span>
          </label>
        </div>

        <div className={sel ? 'grid-matrix' : ''}>
          <DataTable
            csvName="nipunplus-basti-suspicious-results.csv"
            rows={rows}
            initialSort={{ key: 'rank', dir: 'desc' }}
            searchText={(s) => `${s.school.name} ${s.school.block} ${s.udise}`}
            onRowClick={(s) => setSelected(s.udise)}
            empty="No schools match these filters."
            columns={[
              { key: 'name', label: 'School', value: (s) => s.school.name, render: (s) => <span className={`link${s.udise === selected ? ' sel' : ''}`}>{s.school.name}</span> },
              { key: 'block', label: 'Block', value: (s) => s.school.block },
              {
                key: 'rank',
                label: 'Level',
                value: (s) => TIER_RANK[s.tier] * 1000 + s.score * 10 + (s.metrics.excess || 0) / 10,
                render: (s) => (
                  <span className="tier-cell">
                    <span className={`tier-dot tier-${s.tier}`} aria-hidden /> {TIERS[s.tier].label}
                  </span>
                ),
                csv: (s) => TIERS[s.tier].label,
              },
              {
                key: 'flags',
                label: 'Signals',
                sortable: false,
                value: (s) => s.flags.map((k) => SIGNAL[k].short).join('; '),
                render: (s) => (
                  <span className="flag-chips">
                    {s.flags.map((k) => (
                      <span key={k} className={`flag-chip src-${SIGNAL[k].source}`} title={SIGNAL[k].label}>
                        {SIGNAL[k].short}
                      </span>
                    ))}
                    {s.persistent && <span className="flag-chip persistent">Persistent</span>}
                  </span>
                ),
              },
              { key: 'excess', label: 'vs Basti', align: 'right', value: (s) => s.metrics.excess, render: (s) => fmtPts(s.metrics.excess), csv: (s) => s.metrics.excess?.toFixed(1) },
              { key: 'perfect', label: 'At 100%', align: 'right', value: (s) => s.metrics.perfect, render: (s) => pct(s.metrics.perfect * 100), csv: (s) => (s.metrics.perfect * 100).toFixed(0) },
              { key: 'csf', label: 'vs CSF', align: 'right', value: (s) => s.metrics.csf, render: (s) => fmtPts(s.metrics.csf), csv: (s) => s.metrics.csf?.toFixed(1) },
              { key: 'n', label: 'Results', align: 'right', value: (s) => s.n },
              { key: 'months', label: 'Months', align: 'right', value: (s) => s.months.length },
            ]}
          />
          {sel && <SchoolEvidence s={sel} data={data} typical={typical} onClose={() => setSelected(null)} nav={nav} />}
        </div>
      </section>

      <details className="card method">
        <summary>
          <span className="card-title">How the checks work</span>
        </summary>
        <dl className="prose-dl">
          <dt>Comparing like with like</dt>
          <dd>
            Learning outcomes differ a lot in difficulty, so each result is compared with the Basti average for the same LO in the same month. "Above Basti" is the
            school's result minus that average.
          </dd>
          <dt>Thresholds</dt>
          <dd>
            Each threshold sits near the most unusual 5% of Basti schools (perfect scores 70%+, 20+ pts above Basti, above Basti on 90%+ of results, 90%+ all-or-nothing).
            Pooled checks need {MIN_RESULTS}+ results so a handful of results can't trip them.
          </dd>
          <dt>Levels</dt>
          <dd>
            Checks that measure the same thing count once. They form five independent lines of evidence: results too high (mostly perfect, far above Basti, above on
            nearly everything), an implausible pattern (all-or-nothing, whole class passes), a sudden jump, persistence (15+ pts above Basti in every month reported, at
            least two months) and CSF disagreeing. <b>Strong</b>: CSF confirms a NIPUN+ line, or three NIPUN+ lines agree. <b>Watch</b>: two lines. <b>One line</b>: one.
          </dd>
          <dt>What the checks can't see</dt>
          <dd>
            Apr–Jun exports hold school percentages without child counts, so the whole-class check only covers Jul 2026 onward. CSF assessed a minority of schools, so most
            schools are screened on NIPUN+ data alone. Testing more children than are enrolled was also checked: no school did.
          </dd>
        </dl>
      </details>
    </>
  )
}

function SchoolEvidence({ s, data, typical, onClose, nav }) {
  const xs = monthXs(data)
  const mi = (k) => data.months.findIndex((m) => m.key === k)
  const school = data.months.map((m) => s.months.find((x) => x.key === m.key)?.avg ?? null)
  const expected = data.months.map((m) => s.months.find((x) => x.key === m.key)?.expected ?? null)
  const sentence = {
    perfect: () => `${pct(s.metrics.perfect * 100)} of its ${s.n} results are 100% (typical Basti school: ${SIGNAL.perfect.fmt(typical.perfect.median)}).`,
    excess: () => `On average ${fmtPts(s.metrics.excess)} above the Basti average for the same LO and month.`,
    above: () => `Above the Basti average on ${Math.round(s.metrics.above * s.n)} of its ${s.n} results.`,
    allornothing: () => `${pct(s.metrics.allornothing * 100)} of its results are exactly 0% or 100% (typical: ${SIGNAL.allornothing.fmt(typical.allornothing.median)}).`,
    wholeclass: () =>
      `Every child passed, with 90%+ of the grade tested, on ${s.wholeList.length} LOs: ${s.wholeList
        .slice(0, 4)
        .map((r) => `${r.code} (${data.months[mi(r.month)].label.split(' ')[0]}, ${r.a}/${r.n}, enrolled ${r.enrol[r.grade]})`)
        .join('; ')}${s.wholeList.length > 4 ? '…' : ''}.`,
    jump: () => `Average rose ${fmtPts(s.metrics.jump)} (${s.jumpAt}).`,
    csf: () => `Up to ${fmtPts(s.metrics.csf)} above CSF's assessment of the same school.`,
  }
  return (
    <div className="card detail-card evidence">
      <div className="detail-head">
        <div>
          <div className="crumbs">
            {s.school.block} · UDISE {s.udise}
          </div>
          <h2 className="detail-title">{s.school.name}</h2>
          <div className="tier-cell">
            <span className={`tier-dot tier-${s.tier}`} aria-hidden /> {TIERS[s.tier].label}
            {s.persistent && <span className="flag-chip persistent">Persistent</span>}
          </div>
        </div>
        <button className="btn btn-small" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </div>

      <div className="lines-row">
        {LINES.map((l) => (
          <span key={l.key} className={`line-pill${s.lines.includes(l.key) ? ' on' : ''}`}>
            {s.lines.includes(l.key) ? '■' : '□'} {l.label}
          </span>
        ))}
      </div>
      <div className="mini-title">Evidence</div>
      <ul className="evidence-list">
        {s.flags.map((k) => (
          <li key={k}>
            <b>{SIGNAL[k].label}.</b> {sentence[k]()}
          </li>
        ))}
        {s.persistent && (
          <li>
            <b>Persistent.</b> 15+ pts above Basti in every month it reported:{' '}
            {s.months
              .filter((m) => m.n >= 3)
              .map((m) => `${m.label.split(' ')[0]} ${fmtPts(m.excess)}`)
              .join(', ')}
            .
          </li>
        )}
      </ul>

      <div className="mini-title">Its results against Basti on the same LOs</div>
      <LineChart
        xs={xs}
        height={170}
        marker={formatBreak(data)}
        label="School average against the Basti average on the same learning outcomes, by month"
        series={[
          { key: 's', label: 'This school', short: 'School', values: school, color: '#d03b3b' },
          { key: 'e', label: 'Basti on the same LOs', short: 'Basti', values: expected, color: '#7b8594', dash: true },
        ]}
      />

      {s.comps.length > 0 && (
        <>
          <div className="mini-title">CSF's assessment of this school</div>
          <MiniTable
            columns={[
              { key: 'q', label: 'Quarter', value: (c) => `${c.quarter} · G${c.grade} ${c.subject}` },
              { key: 'n', label: 'NIPUN+', align: 'right', value: (c) => pct(c.nipun) },
              { key: 'c', label: 'CSF', align: 'right', value: (c) => `${pct(c.csf)} (${c.children})` },
              { key: 'g', label: 'Gap', align: 'right', value: (c) => fmtPts(c.gap) },
            ]}
            rows={s.comps}
          />
        </>
      )}

      <div className="mini-title">All seven checks</div>
      <MiniTable
        columns={[
          { key: 'c', label: 'Check', value: (r) => (s.flags.includes(r.key) ? <b>{r.label}</b> : r.label) },
          { key: 'v', label: 'School', align: 'right', value: (r) => (s.metrics[r.key] == null ? '—' : r.fmt(s.metrics[r.key])) },
          { key: 't', label: 'Flag at', align: 'right', value: (r) => r.fmt(r.threshold) },
        ]}
        rows={SIGNALS}
      />
      <button className="btn" style={{ marginTop: 12 }} onClick={() => nav('schools', s.udise)}>
        Open school page →
      </button>
    </div>
  )
}
