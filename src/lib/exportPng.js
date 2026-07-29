// Serializes a rendered <svg> (e.g. recharts' output) to a downloaded PNG.
// No charting-library-specific API needed — recharts renders plain SVG, so
// this works by walking the DOM, not by hooking into recharts internals.

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

// container: a DOM node containing exactly one <svg> (the chart wrapper).
export async function exportSvgAsPng(container, filename, { scale = 2, background = '#faf7f2' } = {}) {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('No chart to export yet.')

  const clone = svg.cloneNode(true)
  const width = svg.clientWidth || Number(svg.getAttribute('width')) || 800
  const height = svg.clientHeight || Number(svg.getAttribute('height')) || 400
  clone.setAttribute('width', width)
  clone.setAttribute('height', height)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Failed to rasterize chart.'))
      image.src = svgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)

    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    downloadBlob(pngBlob, filename)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
