// Data-only spreadsheet export for the graph builder. A .csv opens directly
// in Excel/Sheets and is just as chart-ready as a .xlsx for "select the
// range, insert a chart" — without pulling in an xlsx-writing dependency
// (both real options on npm — xlsx and exceljs — currently carry flagged
// high-severity advisories in their write path's dependency tree).

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// rows: array of objects with the same keys as `headers` (in order).
export function exportRowsAsCsv(headers, rows, filename) {
  const lines = [headers.map((h) => csvCell(h.label)).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h.key])).join(','))
  }
  // Leading BOM so Excel opens UTF-8 (₹, →, etc.) correctly instead of guessing an 8-bit codepage.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename)
}
