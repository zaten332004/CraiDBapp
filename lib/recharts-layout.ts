/**
 * Margins / axis widths for Recharts so money ticks and category labels are not clipped.
 * Recharts does not auto-size tick text; reserve space with margin + YAxis.width / XAxis.height.
 */
export const RECHART_MARGIN = {
  lineDualY: { top: 12, right: 28, left: 10, bottom: 22 },
  lineDualYDemo: { top: 10, right: 24, left: 10, bottom: 20 },
  pie: { top: 8, right: 12, bottom: 16, left: 12 },
  barSector: { top: 14, right: 28, left: 12, bottom: 72 },
  barScoreBuckets: { top: 12, right: 20, left: 12, bottom: 36 },
  scatterMoney: { top: 16, right: 32, left: 28, bottom: 44 },
  factors: { top: 10, right: 16, left: 18, bottom: 40 },
  lineSimple: { top: 12, right: 22, left: 14, bottom: 32 },
} as const

export const RECHART_Y_WIDTH = {
  /** formatCompactVnd ticks (e.g. 20.0B đ) */
  money: 96,
  moneyTight: 88,
  score: 48,
  count: 44,
} as const
