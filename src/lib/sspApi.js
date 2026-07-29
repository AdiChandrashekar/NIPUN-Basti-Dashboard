// Fetches from the SSP dashboard's Google Apps Script backend (dbapp.js).
// That deployment doesn't reliably support cross-origin fetch(), which is why
// the SSP dashboard's own index.html uses a JSONP <script> tag instead of
// fetch — this mirrors that same technique.
const SSP_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbx2F7cZoCBqxtYc-yIrBUqLRhyJ-z-xXUWgZ1vjIaJb-Qkxxk0rq4JXIVWPtg_cvf8R/exec'

// The backend now serves three programs (ssp | rmeal | combined). NIPUN+
// always compares against the combined dataset.
const PROGRAM = 'combined'

let jsonpCounter = 0
const cache = new Map()

function fetchJsonp(params) {
  return new Promise((resolve, reject) => {
    const cbName = '__sspJsonpCb' + ++jsonpCounter
    const url = new URL(SSP_ENDPOINT)
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all') url.searchParams.set(k, v)
    })
    url.searchParams.set('callback', cbName)

    const script = document.createElement('script')
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('SSP request timed out (30s)'))
    }, 30000)

    function cleanup() {
      clearTimeout(timer)
      delete window[cbName]
      script.remove()
    }

    window[cbName] = (data) => {
      cleanup()
      resolve(data)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('SSP request failed to load'))
    }
    script.src = url.toString()
    document.head.appendChild(script)
  })
}

// dataset: 'schools' | 'blocks' | 'students'. params: { quarter, grade }.
export async function fetchSsp(dataset, params = {}) {
  const key = JSON.stringify({ dataset, program: PROGRAM, ...params })
  if (cache.has(key)) return cache.get(key)

  const promise = fetchJsonp({ dataset, program: PROGRAM, ...params })
    .then((resp) => {
      if (!resp || !resp.ok) throw new Error(resp?.error || 'SSP API returned an error')
      return resp.data || []
    })
    .catch((err) => {
      cache.delete(key)
      throw err
    })

  cache.set(key, promise)
  return promise
}
