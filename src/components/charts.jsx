import { useLayoutEffect, useRef, useState } from 'react'

// Shared with the ARP Visit Monitoring dashboard: same palette, marks and
// tooltip so the two read as one system.

// Sequential blue ramp (light -> dark) from the reference data-viz palette.
const SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281']

export function seqColor(t) {
  if (t == null || Number.isNaN(t)) return null
  const i = Math.max(0, Math.min(SEQ.length - 1, Math.round(t * (SEQ.length - 1))))
  return { bg: SEQ[i], fg: i >= 6 ? '#ffffff' : '#0b0b0b' }
}

// Categorical slots from the reference palette, in fixed order (never cycled).
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
// The two sources on the comparison page always wear the same slot and marker shape.
export const SOURCE = {
  nipun: { label: 'NIPUN+', color: SERIES[0], shape: 'circle' },
  partner: { label: 'Partner Org', color: SERIES[1], shape: 'diamond' },
}

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceMax(v) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * p
}

function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div className="tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  )
}

export function Marker({ shape, x, y, r = 5, color, ring = 'var(--surface)' }) {
  if (shape === 'diamond') {
    const d = r * 1.25
    return <path d={`M${x},${y - d} L${x + d},${y} L${x},${y + d} L${x - d},${y} Z`} fill={color} stroke={ring} strokeWidth="2" />
  }
  return <circle cx={x} cy={y} r={r} fill={color} stroke={ring} strokeWidth="2" />
}

export function LegendSwatch({ color, shape }) {
  if (!shape) return <span className="legend-swatch" style={{ background: color }} />
  return (
    <svg width="14" height="14" aria-hidden style={{ verticalAlign: 'middle' }}>
      <Marker shape={shape} x={7} y={7} r={4.5} color={color} ring="transparent" />
    </svg>
  )
}

/**
 * Vertical columns, one series. data: [{ key, label, value, tip?, muted? }]
 */
export function ColumnChart({ data, height = 200, valueFormat = (v) => v, onSelect, selectedKey, label = 'Column chart', showValues = true }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  const pad = { l: 44, r: 12, t: 18, b: 28 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const max = niceMax(Math.max(1, ...data.map((d) => d.value || 0)))
  const ticks = [0, 0.5, 1].map((t) => t * max)
  const slot = plotW / Math.max(1, data.length)
  const barW = Math.max(4, Math.min(44, slot - 10))
  const y = (v) => pad.t + plotH - (v / max) * plotH

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
            <text x={pad.l - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {valueFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2
          const h = Math.max(0, y(0) - y(d.value || 0))
          const r = Math.min(4, barW / 2, h)
          const x0 = cx - barW / 2
          const top = y(0) - h
          const dim = (selectedKey && selectedKey !== d.key) || d.muted
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  d={`M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`}
                  className="bar"
                  opacity={dim ? 0.4 : 1}
                />
              )}
              {showValues && d.value != null && (
                <text x={cx} y={top - 5} className="end-label" textAnchor="middle">
                  {valueFormat(d.value)}
                </text>
              )}
              <rect
                x={pad.l + slot * i}
                y={pad.t}
                width={slot}
                height={plotH}
                fill="transparent"
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
                onClick={onSelect ? () => onSelect(d.key) : undefined}
                onMouseMove={(e) => {
                  const box = ref.current.getBoundingClientRect()
                  setTip({ x: Math.min(e.clientX - box.left + 12, width - 200), y: e.clientY - box.top - 10, content: d.tip || `${d.label}: ${valueFormat(d.value)}` })
                }}
              />
              <text x={cx} y={height - 8} className={`tick${selectedKey === d.key ? ' tick-selected' : ''}`} textAnchor="middle">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

/**
 * Lines over a shared x axis (months). One y scale only.
 * xs: [{ key, label }], series: [{ key, label, values: [number|null], color?, dash? }]
 * marker: optional { key, label } - a dashed vertical rule before that x (e.g. a change of source format).
 */
export function LineChart({ xs, series, height = 240, yMax = 100, valueFormat = (v) => `${Math.round(v)}%`, marker, onSelect, selectedKey, label = 'Line chart', notes }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const pad = { l: 40, r: 100, t: 18, b: 28 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const max = yMax ?? niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null))))
  const x = (i) => pad.l + (xs.length === 1 ? plotW / 2 : (plotW * i) / (xs.length - 1))
  const y = (v) => pad.t + plotH - (v / max) * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const colorOf = (s, i) => s.color || SERIES[i]

  const path = (vals) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i)},${y(v)} `
      pen = true
    })
    return d
  }

  // End labels, nudged apart so they never overlap.
  const ends = series
    .map((s, i) => {
      let j = s.values.length - 1
      while (j >= 0 && s.values[j] == null) j--
      return j < 0 ? null : { i, s, y: y(s.values[j]), v: s.values[j] }
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14
  const mi = marker ? xs.findIndex((xv) => xv.key === marker.key) : -1

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s, i) => (
            <span key={s.key} className="legend-item">
              <span className="legend-swatch" style={{ background: colorOf(s, i) }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
            <text x={pad.l - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {valueFormat(t)}
            </text>
          </g>
        ))}
        {xs.map((xv, i) => (
          <text key={xv.key} x={x(i)} y={height - 8} className={`tick${selectedKey === xv.key ? ' tick-selected' : ''}`} textAnchor="middle">
            {xv.label}
          </text>
        ))}
        {mi > 0 && (
          <g>
            <line x1={(x(mi) + x(mi - 1)) / 2} x2={(x(mi) + x(mi - 1)) / 2} y1={pad.t - 6} y2={pad.t + plotH} className="break-line" />
            <text x={(x(mi) + x(mi - 1)) / 2 + 5} y={pad.t - 6} className="ref-label">
              {marker.label}
            </text>
          </g>
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} className="crosshair" />}
        {series.map((s, i) => (
          <g key={s.key}>
            <path d={path(s.values)} fill="none" stroke={colorOf(s, i)} strokeWidth="2" strokeDasharray={s.dash ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, j) =>
              v == null ? null : <circle key={j} cx={x(j)} cy={y(v)} r={hover === j ? 5 : 4} fill={colorOf(s, i)} stroke="var(--surface)" strokeWidth="2" />,
            )}
          </g>
        ))}
        {ends.map((e) => (
          <text key={e.s.key} x={width - pad.r + 8} y={e.y} className="end-label" dominantBaseline="middle">
            {valueFormat(e.v)} {e.s.short ?? e.s.label}
          </text>
        ))}
        {xs.map((xv, i) => (
          <rect
            key={xv.key}
            x={x(i) - plotW / Math.max(2, xs.length - 1) / 2}
            y={pad.t}
            width={plotW / Math.max(1, xs.length - 1)}
            height={plotH}
            fill="transparent"
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onMouseEnter={() => setHover(i)}
            onClick={onSelect ? () => onSelect(xv.key) : undefined}
          />
        ))}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: Math.min(x(hover) + 12, width - 220), top: pad.t }}>
          <b>{xs[hover].label}</b>
          {series.map((s, i) => (
            <div key={s.key}>
              <span className="legend-swatch" style={{ background: colorOf(s, i) }} /> {s.label}: {s.values[hover] == null ? '—' : valueFormat(s.values[hover])}
            </div>
          ))}
          {notes?.[hover] && <div className="tooltip-note">{notes[hover]}</div>}
        </div>
      )}
    </div>
  )
}

/**
 * Horizontal bars as HTML rows: label | bar | value. data: [{ key, label, value, sub?, tip?, status? }]
 * Clickable rows are real buttons, so they work from the keyboard.
 */
export function BarList({ data, max = 100, valueFormat = (v) => `${Math.round(v)}%`, onSelect, reference }) {
  return (
    <div className="barlist" role="list">
      {data.map((d) => {
        const Row = onSelect ? 'button' : 'div'
        return (
          <Row
            key={d.key}
            type={onSelect ? 'button' : undefined}
            role="listitem"
            className={`barlist-row${onSelect ? ' clickable' : ''}`}
            onClick={onSelect ? () => onSelect(d.key) : undefined}
            title={d.tip}
          >
            <span className="barlist-label">{d.label}</span>
            <span className="barlist-track">
              {d.value != null && (
                <span className={`barlist-fill${d.status ? ` fill-${d.status}` : ''}`} style={{ width: `${Math.min(100, (d.value / max) * 100)}%` }} />
              )}
              {reference != null && <span className="barlist-ref" style={{ left: `${(reference / max) * 100}%` }} />}
            </span>
            <span className="barlist-value">
              {d.value == null ? '—' : valueFormat(d.value)}
              {d.sub && <span className="barlist-sub">{d.sub}</span>}
            </span>
          </Row>
        )
      })}
    </div>
  )
}

/**
 * Heatmap table. rows: [{ key, label, title?, group? }], cols: [{ key, label }],
 * cell(rowKey, colKey) -> { value, text, tip } | null. value in [0, max].
 * Rows with a new `group` get a group header row.
 */
export function Heatmap({ rows, cols, cell, max = 100, rowHeader = '', onRowClick, legend, selectedRow }) {
  let lastGroup = null
  return (
    <div className="heatmap-wrap">
      <table className="heatmap">
        <thead>
          <tr>
            <th className="hm-rowhead" scope="col">{rowHeader}</th>
            {cols.map((c) => (
              <th key={c.key} className="hm-colhead" scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r) => {
            const out = []
            if (r.group && r.group !== lastGroup) {
              lastGroup = r.group
              out.push(
                <tr key={`g-${r.group}`} className="group-row">
                  <th colSpan={cols.length + 1} scope="colgroup">
                    {r.group}
                  </th>
                </tr>,
              )
            }
            out.push(
              <tr
                key={r.key}
                className={`${onRowClick ? 'clickable' : ''}${selectedRow === r.key ? ' selected' : ''}`}
                onClick={onRowClick ? () => onRowClick(r.key) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(r.key)) : undefined}
              >
                <th className="hm-rowhead" title={r.title || r.label} scope="row">
                  {r.label}
                </th>
                {cols.map((c) => {
                  const v = cell(r.key, c.key)
                  const col = v && v.value != null ? seqColor(v.value / max) : null
                  return (
                    <td key={c.key} className={`hm-cell${v?.muted ? ' hm-muted' : ''}`} style={col ? { background: col.bg, color: col.fg } : undefined} title={v?.tip}>
                      {v ? v.text : ''}
                    </td>
                  )
                })}
              </tr>,
            )
            return out
          })}
        </tbody>
      </table>
      {legend && <HeatLegend {...legend} />}
    </div>
  )
}

export function HeatLegend({ low = '0%', high = '100%', label, note }) {
  return (
    <div className="hm-legend">
      {label && <span>{label}</span>}
      <span>{low}</span>
      <span className="hm-legend-ramp" style={{ background: `linear-gradient(90deg, ${SEQ[0]}, ${SEQ[SEQ.length - 1]})` }} />
      <span>{high}</span>
      {note && <span>{note}</span>}
    </div>
  )
}

/**
 * 100% stacked columns: one column per x, split into ordered levels.
 * xs: [{ key, label }], levels: [{ key, label, color }],
 * value(xKey) -> { n, [levelKey]: count } | null.
 */
export function StackedShareChart({ xs, levels, value, height = 230, onSelect, selectedKey, unit = 'results', label = 'Stacked share chart' }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  const pad = { l: 40, r: 12, t: 12, b: 28 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const slot = plotW / Math.max(1, xs.length)
  const barW = Math.max(6, Math.min(48, slot - 12))
  const y = (p) => pad.t + plotH - (p / 100) * plotH
  const pctOf = (d, k) => (d.n ? ((d[k] || 0) / d.n) * 100 : 0)

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <div className="legend">
        {levels.map((l) => (
          <span key={l.key} className="legend-item">
            <span className="legend-swatch" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <svg width={width} height={height} role="img" aria-label={label}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
            <text x={pad.l - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {t}%
            </text>
          </g>
        ))}
        {xs.map((xv, i) => {
          const d = value(xv.key)
          const cx = pad.l + slot * i + slot / 2
          const dim = selectedKey && selectedKey !== xv.key
          let acc = 0
          return (
            <g key={xv.key} opacity={dim ? 0.4 : 1}>
              {d &&
                d.n > 0 &&
                levels.map((l) => {
                  const p = pctOf(d, l.key)
                  const top = y(acc + p)
                  const h = y(acc) - top
                  acc += p
                  // 2px surface gap between segments
                  return h > 0 ? (
                    <g key={l.key}>
                      <rect x={cx - barW / 2} y={top} width={barW} height={Math.max(0, h - 2)} fill={l.color} />
                      {h > 16 && barW >= 30 && (
                        <text x={cx} y={top + h / 2} className="seg-label" textAnchor="middle" dominantBaseline="middle" fill={l.ink || '#0b0b0b'}>
                          {Math.round(p)}
                        </text>
                      )}
                    </g>
                  ) : null
                })}
              <rect
                x={pad.l + slot * i}
                y={pad.t}
                width={slot}
                height={plotH}
                fill="transparent"
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
                onClick={onSelect ? () => onSelect(xv.key) : undefined}
                onMouseMove={(e) => {
                  const box = ref.current.getBoundingClientRect()
                  setTip({
                    x: Math.min(e.clientX - box.left + 12, width - 210),
                    y: e.clientY - box.top - 10,
                    content: (
                      <>
                        <b>{xv.label}</b>
                        {d && d.n ? (
                          <>
                            <div>
                              {d.n.toLocaleString('en-IN')} {unit}
                            </div>
                            {[...levels].reverse().map((l) => (
                              <div key={l.key}>
                                <span className="legend-swatch" style={{ background: l.color }} /> {l.label}: {Math.round(pctOf(d, l.key))}% ({(d[l.key] || 0).toLocaleString('en-IN')})
                              </div>
                            ))}
                          </>
                        ) : (
                          <div>No data</div>
                        )}
                      </>
                    ),
                  })
                }}
              />
              <text x={cx} y={height - 8} className={`tick${selectedKey === xv.key ? ' tick-selected' : ''}`} textAnchor="middle">
                {xv.label}
              </text>
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

// Thin inline bar of band shares, for table cells.
export function LevelBar({ s, levels, wide = false }) {
  if (!s || !s.n) return wide ? null : <span className="muted">—</span>
  return (
    <span className={`levelbar${wide ? ' levelbar-wide' : ''}`} title={levels.map((l) => `${l.label}: ${s[l.key] ?? 0}`).join(' · ') + ` of ${s.n}`}>
      {levels.map((l) => (s[l.key] ? <span key={l.key} style={{ width: `${(s[l.key] / s.n) * 100}%`, background: l.color }} /> : null))}
    </span>
  )
}

/**
 * Dumbbell (dot) plot comparing two sources per row, on one 0-100% scale.
 * rows: [{ key, label, sub?, a: number|null, b: number|null, tipA?, tipB? }]
 * a = NIPUN+, b = Partner Org. Rows are direct-labelled with both values and the gap.
 */
export function Dumbbell({ rows, a = SOURCE.nipun, b = SOURCE.partner, label = 'Dot plot', onSelect, selectedKey }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  const labelW = Math.min(240, Math.max(130, width * 0.3))
  const gapW = 74
  const pad = { l: labelW, r: gapW + 8, t: 26, b: 8 }
  const rowH = 34
  const height = pad.t + rows.length * rowH + pad.b
  const plotW = width - pad.l - pad.r
  const x = (v) => pad.l + (v / 100) * plotW

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <div className="legend">
        <span className="legend-item">
          <LegendSwatch color={a.color} shape={a.shape} /> {a.label}
        </span>
        <span className="legend-item">
          <LegendSwatch color={b.color} shape={b.shape} /> {b.label}
        </span>
        <span className="legend-item muted">Gap = {b.label} − {a.label}</span>
      </div>
      <svg width={width} height={height} role="img" aria-label={label}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={pad.t - 4} y2={height - pad.b} className={t === 0 ? 'axis' : 'grid'} />
            <text x={x(t)} y={pad.t - 10} className="tick" textAnchor="middle">
              {t}%
            </text>
          </g>
        ))}
        <text x={width - 4} y={pad.t - 10} className="tick" textAnchor="end">
          Gap
        </text>
        {rows.map((r, i) => {
          const cy = pad.t + i * rowH + rowH / 2
          const gap = r.a != null && r.b != null ? r.b - r.a : null
          const sel = selectedKey === r.key
          return (
            <g
              key={r.key}
              className={onSelect ? 'db-row clickable' : 'db-row'}
              onClick={onSelect ? () => onSelect(r.key) : undefined}
              tabIndex={onSelect ? 0 : undefined}
              role={onSelect ? 'button' : undefined}
              aria-label={`${r.label}: ${a.label} ${r.a == null ? 'no data' : Math.round(r.a) + '%'}, ${b.label} ${r.b == null ? 'no data' : Math.round(r.b) + '%'}`}
              onKeyDown={onSelect ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(r.key)) : undefined}
            >
              <rect x={0} y={cy - rowH / 2} width={width} height={rowH} className={`db-hit${sel ? ' selected' : ''}`} />
              <text x={8} y={r.sub ? cy - 6 : cy} className="db-label" dominantBaseline="middle">
                {r.label.length > 34 ? r.label.slice(0, 33) + '…' : r.label}
              </text>
              {r.sub && (
                <text x={8} y={cy + 8} className="db-sub" dominantBaseline="middle">
                  {r.sub}
                </text>
              )}
              {r.a != null && r.b != null && <line x1={x(r.a)} x2={x(r.b)} y1={cy} y2={cy} className="db-link" />}
              {[
                [r.a, a, r.tipA],
                [r.b, b, r.tipB],
              ].map(([v, src, t], k) =>
                v == null ? null : (
                  <g
                    key={k}
                    onMouseMove={(e) => {
                      const box = ref.current.getBoundingClientRect()
                      setTip({ x: Math.min(e.clientX - box.left + 12, width - 240), y: e.clientY - box.top - 10, content: t || `${src.label}: ${Math.round(v)}%` })
                    }}
                  >
                    <circle cx={x(v)} cy={cy} r={11} fill="transparent" />
                    <Marker shape={src.shape} x={x(v)} y={cy} r={6} color={src.color} />
                  </g>
                ),
              )}
              <text x={width - 4} y={cy} className={`db-gap ${gap == null ? '' : gap > 0 ? 'gap-pos' : gap < 0 ? 'gap-neg' : ''}`} textAnchor="end" dominantBaseline="middle">
                {gap == null ? 'no match' : `${gap > 0 ? '+' : gap < 0 ? '−' : '±'}${Math.abs(Math.round(gap))} pts`}
              </text>
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

/**
 * Scatter of matched items on two 0-100% axes with the y = x line.
 * points: [{ key, label, x, y, tip? }]. Points above the line: y-source higher.
 */
export function Scatter({ points, xLabel, yLabel, height = 320, label = 'Scatter plot', color = SERIES[0] }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  const size = Math.min(width, height + 60)
  const pad = { l: 48, r: 16, t: 12, b: 40 }
  const plotW = size - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const sx = (v) => pad.l + (v / 100) * plotW
  const sy = (v) => pad.t + plotH - (v / 100) * plotH
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={size} height={height} role="img" aria-label={label}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + plotW} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'axis' : 'grid'} />
            <line x1={sx(t)} x2={sx(t)} y1={pad.t} y2={pad.t + plotH} className={t === 0 ? 'axis' : 'grid'} />
            <text x={pad.l - 6} y={sy(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {t}%
            </text>
            <text x={sx(t)} y={pad.t + plotH + 14} className="tick" textAnchor="middle">
              {t}%
            </text>
          </g>
        ))}
        <line x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} className="ref-diag" />
        <text x={sx(97)} y={sy(97) + 14} className="ref-label" textAnchor="end">
          equal
        </text>
        <text x={pad.l + plotW / 2} y={height - 4} className="axis-title" textAnchor="middle">
          {xLabel}
        </text>
        <text x={12} y={pad.t + plotH / 2} className="axis-title" textAnchor="middle" transform={`rotate(-90 12 ${pad.t + plotH / 2})`}>
          {yLabel}
        </text>
        {points.map((p) => (
          <circle
            key={p.key}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={5}
            fill={color}
            fillOpacity={0.75}
            stroke="var(--surface)"
            strokeWidth="1.5"
            onMouseMove={(e) => {
              const box = ref.current.getBoundingClientRect()
              setTip({ x: Math.min(e.clientX - box.left + 12, width - 240), y: e.clientY - box.top - 10, content: p.tip || p.label })
            }}
          />
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}
