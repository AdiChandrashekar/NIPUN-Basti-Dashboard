import Papa from 'papaparse'

const COMPETENCY_CODES = [
  'H104.2', 'H106.1', 'H108.1', 'M 101.1 (A)', 'M 101.1 (B)', 'M101.2', 'M102.1', 'M102.3',
  'H202.2', 'H106.2', 'H108.3', 'M201.2', 'M201.3', 'M103.1/M103.2', 'M205.1', 'M207.1',
  'H208', 'H211', 'M301.1', 'M301.2', 'M301.4', 'M302.1', 'H301',
]

async function fetchCsv(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
  return parsed.data
}

export async function loadData(sources) {
  const [rawRows, metaRows] = await Promise.all([
    fetchCsv(sources.rawScoresUrl),
    fetchCsv(sources.competencyMetaUrl),
  ])

  const rows = rawRows
    .filter((r) => r.SchoolCode)
    .map((r) => {
      const clean = { ...r }
      for (const code of COMPETENCY_CODES) {
        const v = clean[code]
        clean[code] = typeof v === 'number' ? v : v === '' || v === undefined ? null : Number(v)
      }
      return clean
    })

  const meta = metaRows.filter((r) => r.Code)

  return { rows, meta }
}
