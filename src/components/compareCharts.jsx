import { useState } from 'react'
import { LegendSwatch, Marker, SOURCE, Tooltip, useWidth } from './charts.jsx'
import { BANDS3, CATEGORY } from '../lib/compare.js'

// Category colours: each "higher" category wears the colour (and marker shape) of
// the source that is higher; agreement is neutral grey.
export const CAT_STYLE = {
  nipun: { color: SOURCE.nipun.color, ink: SOURCE.nipun.ink, shape: 'circle', tint: '#e8f1fc' },
  agree: { color: '#7b8594', ink: '#4a5568', shape: 'square', tint: '#eef0f3' },
  partner: { color: SOURCE.partner.color, ink: SOURCE.partner.ink, shape: 'diamond', tint: '#fdeee7' },
}

function CatMarker({ cat, x, y, r = 5 }) {
  const s = CAT_STYLE[cat]
  if (s.shape === 'square') return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />
  return <Marker shape={s.shape} x={x} y={y} r={r} color={s.color} />
}

export function CatSwatch({ cat }) {
  return (
    <svg width="14" height="14" aria-hidden style={{ verticalAlign: 'middle' }}>
      <CatMarker cat={cat} x={7} y={7} r={4.5} />
    </svg>
  )
}

/** Schools assessed by NIPUN+ only, by both, by the Partner Org only. */
export function CoverageBar({ onlyNipun, both, onlyPartner }) {
  const total = onlyNipun + both + onlyPartner || 1
  const segs = [
    { key: 'n', label: 'NIPUN+ only', v: onlyNipun, cls: 'cov-nipun' },
    { key: 'b', label: 'Both', v: both, cls: 'cov-both' },
    { key: 'p', label: 'Partner Org only', v: onlyPartner, cls: 'cov-partner' },
  ]
  return (
    <div className="coverage">
      <div className="coverage-bar" role="img" aria-label={segs.map((s) => `${s.label}: ${s.v} schools`).join(', ')}>
        {segs.map((s) =>
          s.v ? (
            <span key={s.key} className={s.cls} style={{ flexGrow: s.v, minWidth: 28 }} title={`${s.label}: ${s.v} schools`}>
              {s.v}
            </span>
          ) : null,
        )}
      </div>
      <div className="coverage-legend">
        {segs.map((s) => (
          <span key={s.key} className="legend-item">
            <span className={`legend-swatch ${s.cls}`} />
            {s.label} · <b>{s.v.toLocaleString('en-IN')}</b> ({Math.round((s.v / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * 3 × 3 table: NIPUN+ band (rows, high at top) × Partner Org band (columns).
 * The diagonal is agreement. Cells are buttons that filter the school list.
 */
export function AgreementMatrix({ matrix, selected, onSelect }) {
  const total = matrix.flat().reduce((a, b) => a + b, 0) || 1
  const rows = [...BANDS3].reverse()
  return (
    <div className="agree-wrap">
      <table className="agree">
        <caption className="sr-only">Schools by NIPUN+ band (rows) and Partner Org band (columns)</caption>
        <thead>
          <tr>
            <td />
            <th colSpan={3} scope="colgroup" className="agree-axis agree-axis-p">
              <LegendSwatch color={SOURCE.partner.color} shape={SOURCE.partner.shape} /> Partner Org
            </th>
          </tr>
          <tr>
            <th scope="col" className="agree-axis agree-axis-n">
              <LegendSwatch color={SOURCE.nipun.color} shape={SOURCE.nipun.shape} /> NIPUN+
            </th>
            {BANDS3.map((b) => (
              <th key={b.key} scope="col" className="agree-colhead">
                {b.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((nb) => (
            <tr key={nb.key}>
              <th scope="row" className="agree-rowhead">
                {nb.label}
              </th>
              {BANDS3.map((pb) => {
                const cat = nb.key > pb.key ? 'nipun' : nb.key < pb.key ? 'partner' : 'agree'
                const v = matrix[nb.key][pb.key]
                const key = `${nb.key}-${pb.key}`
                const sel = selected === key
                return (
                  <td key={pb.key} className={`agree-cell cat-${cat}${sel ? ' selected' : ''}`} style={{ background: CAT_STYLE[cat].tint }}>
                    <button
                      type="button"
                      aria-pressed={sel}
                      onClick={() => onSelect(sel ? null : key)}
                      aria-label={`${v} schools: NIPUN+ ${nb.label}, Partner Org ${pb.label} (${CATEGORY[cat].label}). Show these schools.`}
                      disabled={!v}
                    >
                      <span className="agree-n">{v}</span>
                      <span className="agree-pct">{Math.round((v / total) * 100)}%</span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend agree-legend">
        {['nipun', 'agree', 'partner'].map((c) => (
          <span key={c} className="legend-item">
            <span className="legend-swatch" style={{ background: CAT_STYLE[c].tint, outline: `1px solid ${CAT_STYLE[c].color}` }} />
            {CATEGORY[c].label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Each matched school: x = Partner Org, y = NIPUN+. The shaded squares on the
 * diagonal are "same band"; above the diagonal NIPUN+ is higher.
 */
export function AgreementScatter({ points, label, highlight }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  const height = Math.min(420, Math.max(300, width * 0.75))
  const pad = { l: 52, r: 14, t: 14, b: 44 }
  const size = Math.min(width - pad.l - pad.r, height - pad.t - pad.b)
  const sx = (v) => pad.l + (v / 100) * size
  const sy = (v) => pad.t + size - (v / 100) * size
  const cuts = [0, 50, 75, 100]
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={pad.l + size + pad.r} height={pad.t + size + pad.b} role="img" aria-label={label}>
        {cuts.slice(0, 3).map((lo, i) => (
          <rect key={lo} x={sx(lo)} y={sy(cuts[i + 1])} width={sx(cuts[i + 1]) - sx(lo)} height={sy(lo) - sy(cuts[i + 1])} fill={CAT_STYLE.agree.tint} />
        ))}
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={sx(0)} x2={sx(100)} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'axis' : t === 50 || t === 75 ? 'band-line' : 'grid'} />
            <line x1={sx(t)} x2={sx(t)} y1={sy(0)} y2={sy(100)} className={t === 0 ? 'axis' : t === 50 || t === 75 ? 'band-line' : 'grid'} />
            <text x={sx(0) - 6} y={sy(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {t}%
            </text>
            <text x={sx(t)} y={sy(0) + 15} className="tick" textAnchor="middle">
              {t}%
            </text>
          </g>
        ))}
        <line x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} className="ref-diag" />
        <text x={sx(4)} y={sy(96)} className="zone-label" style={{ fill: SOURCE.nipun.ink }}>
          NIPUN+ higher
        </text>
        <text x={sx(96)} y={sy(4)} className="zone-label" textAnchor="end" style={{ fill: SOURCE.partner.ink }}>
          Partner Org higher
        </text>
        <text x={sx(50)} y={sy(0) + 36} className="axis-title" textAnchor="middle">
          Partner Org · share of skill checks passed
        </text>
        <text x={14} y={sy(50)} className="axis-title" textAnchor="middle" transform={`rotate(-90 14 ${sy(50)})`}>
          NIPUN+ · share of children achieving
        </text>
        {points.map((p) => {
          const dim = highlight && !highlight(p)
          return (
            <g
              key={p.key}
              opacity={dim ? 0.15 : 0.9}
              onMouseMove={(e) => {
                const box = ref.current.getBoundingClientRect()
                setTip({ x: Math.min(e.clientX - box.left + 12, width - 250), y: e.clientY - box.top - 10, content: p.tip })
              }}
            >
              <CatMarker cat={p.cat} x={sx(p.x)} y={sy(p.y)} r={5} />
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

/**
 * One row per item, both sources on one 0–100% scale, gap = NIPUN+ − Partner Org
 * written in the colour of whichever source is higher.
 */
export function DotCompare({ rows, label }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  // Narrow screens: the label sits above its dots instead of beside them.
  const compact = width < 520
  const labelW = compact ? 10 : Math.min(220, Math.max(120, width * 0.28))
  const pad = { l: labelW, r: compact ? 64 : 84, t: 26, b: 6 }
  const rowH = compact ? 50 : 34
  const height = pad.t + rows.length * rowH + pad.b
  const plotW = width - pad.l - pad.r
  const x = (v) => pad.l + (v / 100) * plotW
  const show = (e, content) => {
    const box = ref.current.getBoundingClientRect()
    setTip({ x: Math.min(e.clientX - box.left + 12, width - 250), y: e.clientY - box.top - 10, content })
  }
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <div className="legend">
        {[SOURCE.nipun, SOURCE.partner].map((s) => (
          <span key={s.key} className="legend-item">
            <LegendSwatch color={s.color} shape={s.shape} /> {s.label}
          </span>
        ))}
        <span className="legend-item muted">Gap = NIPUN+ − Partner Org</span>
      </div>
      <svg width={width} height={height} role="img" aria-label={label}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={pad.t - 4} y2={height - pad.b} className={t === 0 ? 'axis' : t === 50 || t === 75 ? 'band-line' : 'grid'} />
            <text x={x(t)} y={pad.t - 10} className="tick" textAnchor="middle">
              {t}%
            </text>
          </g>
        ))}
        <text x={width - 4} y={pad.t - 10} className="tick" textAnchor="end">
          Gap
        </text>
        {rows.map((r, i) => {
          const top = pad.t + i * rowH
          const cy = compact ? top + 35 : top + rowH / 2
          const gap = r.nipun != null && r.partner != null ? r.nipun - r.partner : null
          const ink = gap == null || Math.abs(gap) < 0.5 ? 'var(--ink-2)' : gap > 0 ? SOURCE.nipun.ink : SOURCE.partner.ink
          return (
            <g key={r.key}>
              <rect x={0} y={top} width={width} height={rowH} className={i % 2 ? 'row-band' : 'row-plain'} />
              {compact ? (
                <text x={6} y={top + 13} dominantBaseline="middle">
                  <tspan className="db-label">{r.label}</tspan>
                  {r.sub && <tspan className="db-sub"> · {r.sub}</tspan>}
                </text>
              ) : (
                <>
                  <text x={6} y={r.sub ? cy - 6 : cy} className="db-label" dominantBaseline="middle">
                    {r.label}
                  </text>
                  {r.sub && (
                    <text x={6} y={cy + 8} className="db-sub" dominantBaseline="middle">
                      {r.sub}
                    </text>
                  )}
                </>
              )}
              {gap != null && <line x1={x(r.nipun)} x2={x(r.partner)} y1={cy} y2={cy} className="db-link" />}
              {r.partner != null && (
                <g onMouseMove={(e) => show(e, r.tipPartner)}>
                  <circle cx={x(r.partner)} cy={cy} r={11} fill="transparent" />
                  <Marker shape={SOURCE.partner.shape} x={x(r.partner)} y={cy} r={6} color={SOURCE.partner.color} />
                </g>
              )}
              {r.nipun != null && (
                <g onMouseMove={(e) => show(e, r.tipNipun)}>
                  <circle cx={x(r.nipun)} cy={cy} r={11} fill="transparent" />
                  <Marker shape={SOURCE.nipun.shape} x={x(r.nipun)} y={cy} r={6} color={SOURCE.nipun.color} />
                </g>
              )}
              <text x={width - 4} y={cy} className="db-gap" style={{ fill: ink }} textAnchor="end" dominantBaseline="middle">
                {gap == null ? '—' : `${gap > 0 ? '+' : gap < 0 ? '−' : '±'}${Math.abs(Math.round(gap))} pts`}
              </text>
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}
