export function fmtNum(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString()
}

export function fmtPct(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${(n * 100).toFixed(d)}%`
}

export function fmtSigned(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const s = n > 0 ? '+' : ''
  return `${s}${n.toFixed(d)}`
}
