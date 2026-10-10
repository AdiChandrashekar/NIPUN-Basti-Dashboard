// Partner Org data: the SSP dashboard's Apps Script backend, read with JSONP
// (the deployment doesn't support cross-origin fetch). Always the combined
// programme view, Basti only.
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
      reject(new Error('the Partner Org backend did not answer within 45 seconds'))
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
      reject(new Error('the Partner Org backend could not be reached'))
    }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}

/** Per-school rows for one quarter and grade. */
export function fetchPartnerSchools(quarter, grade) {
  const key = `${quarter}|${grade}`
  if (!cache.has(key)) {
    const p = jsonp({ dataset: 'schools', program: PROGRAM, quarter, grade })
      .then((r) => {
        if (!r?.ok) throw new Error(r?.error || 'the Partner Org backend returned an error')
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

// Partner Org competencies by grade (mirrors the backend's FIELD_MAX / FIELD_LABEL).
const FIELDS = {
  1: ['listeningComp', 'oralVocab', 'pictureComp', 'numberId', 'measurement'],
  2: ['letterId', 'wordReading', 'sentenceReading', 'wordWriting', 'numberId', 'placeValue', 'pattern', 'addition', 'subtraction'],
  3: ['letterId', 'wordReading', 'readingComp', 'sentenceWriting', 'numberId', 'placeValue', 'pattern', 'addition', 'subtraction'],
}
const LABEL = {
  listeningComp: 'Listening comprehension', oralVocab: 'Oral vocabulary', pictureComp: 'Picture comprehension',
  letterId: 'Letter identification', wordReading: 'Word reading', sentenceReading: 'Sentence reading',
  readingComp: 'Reading comprehension', wordWriting: 'Word writing', sentenceWriting: 'Sentence writing',
  numberId: 'Number identification', placeValue: 'Place value', pattern: 'Patterns', addition: 'Addition',
  subtraction: 'Subtraction', measurement: 'Measurement',
}
const MATHS = new Set(['numberId', 'placeValue', 'pattern', 'addition', 'subtraction', 'measurement'])

export const PARTNER_GRADES = ['1', '2', '3']
export const partnerFields = (grade) => (FIELDS[grade] || []).map((code) => ({ code, label: LABEL[code], subject: MATHS.has(code) ? 'Maths' : 'Hindi' }))
export const partnerLabel = (code) => LABEL[code] || code

export const QUARTERS = [
  { key: 'Q1', label: 'Q1 · Apr–Jun 2026', months: ['2026-04', '2026-05', '2026-06'] },
  { key: 'Q2', label: 'Q2 · Jul–Sep 2026', months: ['2026-07', '2026-08', '2026-09'] },
  { key: 'Q3', label: 'Q3 · Oct–Dec 2026', months: ['2026-10', '2026-11', '2026-12'] },
]

// Suggested skill pairs: the NIPUN+ learning outcome(s) that test the same skill as a
// Partner Org competency. NIPUN+ codes are a list so the Apr–Jun legacy codes count too.
export const SUGGESTED_PAIRS = [
  { skill: 'Word reading', nipun: ['H106.1'], partner: 'wordReading' },
  { skill: 'Sentence reading', nipun: ['H106.2'], partner: 'sentenceReading' },
  { skill: 'Reading comprehension', nipun: ['H208'], partner: 'readingComp' },
  { skill: 'Sentence writing', nipun: ['H108.3', 'H211'], partner: 'sentenceWriting' },
  { skill: 'Listening', nipun: ['H301'], partner: 'listeningComp' },
  { skill: 'Oral language', nipun: ['H104.2', 'H202.2'], partner: 'oralVocab' },
  { skill: 'Number recognition', nipun: ['M102.1', 'M301.1'], partner: 'numberId' },
  { skill: 'Place value', nipun: ['M201.2', 'M301.2'], partner: 'placeValue' },
  { skill: 'Addition', nipun: ['M103.1', 'M103.1/M103.2'], partner: 'addition' },
  { skill: 'Subtraction', nipun: ['M103.2', 'M103.1/M103.2'], partner: 'subtraction' },
  { skill: 'Patterns', nipun: ['M207.1'], partner: 'pattern' },
]

// Block names differ in spelling between the two sources ("HARRIYA" / "Harraiya").
const ALIASES = {
  dubaulia: 'dubauliya', harriya: 'harraiya', kudraha: 'kudaraha', parshurampur: 'parasurampur', rudholi: 'rudhauli',
  saltovagopalpur: 'saltauwagopalpur', saltauagopalpur: 'saltauwagopalpur', saunghat: 'saughat', captainganj: 'kaptanganj',
}
export function blockKey(name) {
  const k = String(name || '').toLowerCase().replace(/[^a-z]/g, '')
  return ALIASES[k] || k
}

/** Student-weighted Partner Org average for one competency over a set of school rows. */
export function partnerAverage(schools, field) {
  let w = 0
  let sum = 0
  let n = 0
  for (const s of schools) {
    const v = s[field]
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    w += s.totalStudents
    sum += v * s.totalStudents
    n++
  }
  return { avg: w ? sum / w : null, schools: n, students: w }
}
