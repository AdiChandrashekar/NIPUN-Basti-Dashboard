// Shared 4-band score-distribution bucketing (0% / 1–49% / 50–75% / >75%),
// used for both the NIPUN+ CSV side (analysis.js) and the Partner Org side
// (graphData.js) so the two sides bucket identically. Values are expected as
// 0-100 percentages already (a school's average pass-rate on a competency,
// or a raw score already normalized against its max).

export const BAND_LOW = 50
export const BAND_HIGH = 75

export function computeBands(values) {
  const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x))
  const total = v.length || 1
  const zeroCount = v.filter((x) => x === 0).length
  const lowCount = v.filter((x) => x > 0 && x < BAND_LOW).length
  const midCount = v.filter((x) => x >= BAND_LOW && x <= BAND_HIGH).length
  const highCount = v.filter((x) => x > BAND_HIGH).length
  return {
    n: v.length,
    zeroCount,
    bandZero: zeroCount / total,
    bandLow: lowCount / total,
    bandMid: midCount / total,
    bandHigh: highCount / total,
  }
}
