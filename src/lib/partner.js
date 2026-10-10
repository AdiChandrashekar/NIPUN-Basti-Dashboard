// CSF data: the SSP dashboard's Apps Script backend, read with JSONP
// (the deployment doesn't support cross-origin fetch). Always the combined
// programme view. Only the per-school dataset is used: it holds no child names.
const ENDPOINT =
  'https://script.google.com/macros/s/AKfycbyouo7904PCiPN2EqGd9tf7glBa0gU_136N_IAmHBxieF6EP_RLKL-6iHkktp942ELs/exec'
const PROGRAM = 'combined'

let counter = 0
const cache = new Map()

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const cb = `__partnerCb${++counter}`
    const url = new URL(ENDPOINT)
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))
    url.searchParams.set('callback', cb)
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('the CSF backend did not answer within 45 seconds'))
    }, 45000)
    function cleanup() {
      clearTimeout(timer)
      delete window[cb]
      script.remove()
    }
    window[cb] = (data) => {
      cleanup()
      resolve(data)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('the CSF backend could not be reached'))
    }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}

/** Per-school rows for one quarter and grade (schools with at least one child assessed). */
export function fetchPartnerSchools(quarter, grade) {
  const key = `${quarter}|${grade}`
  if (!cache.has(key)) {
    const p = jsonp({ dataset: 'schools', program: PROGRAM, quarter, grade })
      .then((r) => {
        if (!r?.ok) throw new Error(r?.error || 'the CSF backend returned an error')
        return (r.data || []).filter((s) => s.totalStudents > 0)
      })
      .catch((e) => {
        cache.delete(key)
        throw e
      })
    cache.set(key, p)
  }
  return cache.get(key)
}

export const PARTNER_GRADES = ['1', '2', '3']

export const QUARTERS = [
  { key: 'Q1', label: 'Apr–Jun 2026', months: ['2026-04', '2026-05', '2026-06'] },
  { key: 'Q2', label: 'Jul–Sep 2026', months: ['2026-07', '2026-08', '2026-09'] },
  { key: 'Q3', label: 'Oct–Dec 2026', months: ['2026-10', '2026-11', '2026-12'] },
]

// A CSF school's literacyPct / numeracyPct: the average, over its children,
// of the share of that subject's competencies the child passed (75%+ of marks).
export const PARTNER_SUBJECT_FIELD = { Hindi: 'literacyPct', Maths: 'numeracyPct' }

// Block names differ in spelling between the two sources ("HARRIYA" / "Harraiya").
const ALIASES = {
  dubaulia: 'dubauliya', harriya: 'harraiya', kudraha: 'kudaraha', parshurampur: 'parasurampur', rudholi: 'rudhauli',
  saltovagopalpur: 'saltauwagopalpur', saltauagopalpur: 'saltauwagopalpur', saunghat: 'saughat', captainganj: 'kaptanganj',
}
export function blockKey(name) {
  const k = String(name || '').toLowerCase().replace(/[^a-z]/g, '')
  return ALIASES[k] || k
}
