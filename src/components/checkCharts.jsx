import { useState } from 'react'
import { Tooltip, useWidth } from './charts.jsx'

const FLAG = '#d03b3b'
const BASE = '#b7c3d3'

/**
 * Tiny histogram of one metric across Basti schools, with the signal threshold.
 * Bars at or beyond the threshold are red, so the flagged tail is visible at a glance.
 */
export function MiniHistogram({ values, threshold, min, max, bins = 24, label, fmt }) {
  const [ref, width] = useWidth()
  const height = 54
  const lo = min ?? Math.min(...values)
  const hi = max ?? Math.max(...values)
  const step = (hi - lo) / bins || 1
  const counts = Array(bins).fill(0)
  values.forEach((v) => counts[Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / step)))]++)
  const top = Math.max(1, ...counts)
  const bw = width / bins
  const x = (v) => ((v - lo) / (hi - lo || 1)) * width
  return (
    <div className="chart mini-hist" ref={ref}>
      <svg width={width} height={height + 14} role="img" aria-label={label}>
        {counts.map((c, i) => {
          const h = c ? Math.max(1.5, (Math.sqrt(c) / Math.sqrt(top)) * height) : 0
          const flagged = lo + (i + 0.5) * step >= threshold
          return <rect key={i} x={i * bw + 1} y={height - h} width={Math.max(1, bw - 2)} height={h} rx={1} fill={flagged ? FLAG : BASE} />
        })}
        <line x1={x(threshold)} x2={x(threshold)} y1={0} y2={height} className="thr-line" />
        <line x1={0} x2={width} y1={height} y2={height} className="axis" />
        {x(threshold) > 70 && (
          <text x={0} y={height + 12} className="tick">
            {fmt(lo)}
          </text>
        )}
        {x(threshold) < width - 70 && (
          <text x={width} y={height + 12} className="tick" textAnchor="end">
            {fmt(hi)}
          </text>
        )}
        <text x={Math.min(Math.max(x(threshold), 30), width - 30)} y={height + 12} className="tick thr-tick" textAnchor="middle">
          {fmt(threshold)}
        </text>
      </svg>
    </div>
  )
}

/**
 * Validation scatter: x = how far above Basti a school's NIPUN+ results are
 * (NIPUN+ data only), y = how far above CSF's assessment it is.
 */
export function ValidationScatter({ points, xRef, yRef, onSelect }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState(null)
  const height = 300
  const pad = { l: 48, r: 14, t: 14, b: 42 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = Math.min(-40, Math.floor(Math.min(...xs) / 10) * 10)
  const x1 = Math.max(50, Math.ceil(Math.max(...xs) / 10) * 10)
  const y0 = Math.min(-50, Math.floor(Math.min(...ys) / 25) * 25)
  const y1 = Math.max(75, Math.ceil(Math.max(...ys) / 25) * 25)
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const sx = (v) => pad.l + ((v - x0) / (x1 - x0)) * W
  const sy = (v) => pad.t + H - ((v - y0) / (y1 - y0)) * H
  const xt = []
  for (let v = Math.ceil(x0 / 20) * 20; v <= x1; v += 20) xt.push(v)
  const yt = []
  for (let v = Math.ceil(y0 / 25) * 25; v <= y1; v += 25) yt.push(v)
  const sgn = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={width} height={height} role="img" aria-label="Schools: points above Basti on NIPUN+ against points above CSF">
        <rect x={sx(xRef)} y={sy(y1)} width={sx(x1) - sx(xRef)} height={sy(yRef) - sy(y1)} className="flag-zone" />
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={pad.t} y2={pad.t + H} className={t === 0 ? 'axis' : 'grid'} />
            <text x={sx(t)} y={pad.t + H + 14} className="tick" textAnchor="middle">
              {sgn(t)}
            </text>
          </g>
        ))}
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={pad.l + W} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'axis' : 'grid'} />
            <text x={pad.l - 6} y={sy(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {sgn(t)}
            </text>
          </g>
        ))}
        <line x1={sx(xRef)} x2={sx(xRef)} y1={pad.t} y2={pad.t + H} className="thr-line" />
        <line x1={pad.l} x2={pad.l + W} y1={sy(yRef)} y2={sy(yRef)} className="thr-line" />
        <text x={sx(x1) - 4} y={sy(y1) + 12} className="zone-label" textAnchor="end" style={{ fill: '#b02727' }}>
          Both checks flag it
        </text>
        <text x={pad.l + W / 2} y={height - 4} className="axis-title" textAnchor="middle">
          NIPUN+ only: average pts above Basti on the same LOs
        </text>
        <text x={12} y={pad.t + H / 2} className="axis-title" textAnchor="middle" transform={`rotate(-90 12 ${pad.t + H / 2})`}>
          Pts above CSF (NIPUN+ − CSF)
        </text>
        {points.map((p) => (
          <circle
            key={p.key}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={p.flagged ? 6 : 4.5}
            fill={p.flagged ? FLAG : '#7b8594'}
            fillOpacity={p.flagged ? 0.9 : 0.55}
            stroke="var(--surface)"
            strokeWidth="1.5"
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={onSelect ? () => onSelect(p.key) : undefined}
            onMouseMove={(e) => {
              const box = ref.current.getBoundingClientRect()
              setTip({ x: Math.min(e.clientX - box.left + 12, width - 250), y: e.clientY - box.top - 10, content: p.tip })
            }}
          />
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}
