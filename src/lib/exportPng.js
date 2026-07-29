// Serializes a rendered <svg> (e.g. recharts' output) to a downloaded PNG.
// No charting-library-specific API needed — recharts renders plain SVG, so
// this works by walking the DOM, not by hooking into recharts internals.
//
// recharts' <Legend> renders as HTML *outside* the <svg> (for accessible,
// flexible layout), so it's invisible to an export that only rasterizes the
// svg element. legendItems/footerText let the caller replicate a legend and
// a totals line by drawing them straight onto the canvas instead.

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

function drawLegend(ctx, items, width, top) {
  const rowHeight = 18
  const swatch = 10
  const gapAfterSwatch = 5
  const gapBetweenItems = 18
  const padding = 10

  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  let x = padding
  let y = top + rowHeight / 2
  let rows = 1

  items.forEach((item) => {
    const textWidth = ctx.measureText(item.label).width
    const itemWidth = swatch + gapAfterSwatch + textWidth
    if (x + itemWidth > width - padding && x > padding) {
      x = padding
      y += rowHeight
      rows += 1
    }
    ctx.fillStyle = item.color
    ctx.fillRect(x, y - swatch / 2, swatch, swatch)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillText(item.label, x + swatch + gapAfterSwatch, y + 1)
    x += itemWidth + gapBetweenItems
  })

  return rows * rowHeight
}

// container: a DOM node containing exactly one <svg> (the chart wrapper).
// legendItems: [{ label, color }]. footerText: e.g. a totals line, drawn bottom-right.
export async function exportSvgAsPng(container, filename, { scale = 2, background = '#faf7f2', legendItems = [], footerText = '' } = {}) {
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

    // Measure the legend first (font must be set on a context, so do a throwaway
    // measure pass) to know how much extra height to reserve above the chart.
    const measureCanvas = document.createElement('canvas')
    const measureCtx = measureCanvas.getContext('2d')
    const legendHeight = legendItems.length ? (() => {
      // Re-run the same wrapping logic without drawing, just to get row count.
      let x = 10
      let rows = 1
      measureCtx.font = '600 11px system-ui, sans-serif'
      legendItems.forEach((item) => {
        const w = 10 + 5 + measureCtx.measureText(item.label).width
        if (x + w > width - 10 && x > 10) {
          x = 10
          rows += 1
        }
        x += w + 18
      })
      return rows * 18 + 6
    })() : 0
    const footerHeight = footerText ? 22 : 0

    const totalHeight = height + legendHeight + footerHeight
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = totalHeight * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)

    if (legendItems.length) drawLegend(ctx, legendItems, width, 6)
    ctx.drawImage(img, 0, legendHeight, width, height)

    if (footerText) {
      ctx.font = '500 11px system-ui, sans-serif'
      ctx.fillStyle = '#5a5a5a'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(footerText, width - 8, legendHeight + height + 16)
    }

    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    downloadBlob(pngBlob, filename)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
