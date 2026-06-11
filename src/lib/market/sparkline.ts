export function closesToPath(closes: number[], w: number, h: number): string {
  if (closes.length === 0) {
    return ''
  }

  if (closes.length === 1) {
    const y = h / 2
    return `M 0 ${y} L ${w} ${y}`
  }

  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1

  const points = closes.map((close, index) => {
    const x = (index / (closes.length - 1)) * w
    const y = h - ((close - min) / range) * h
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  return `M ${points.join(' L ')}`
}

export function sparklineStrokeColor(closes: number[]): string {
  if (closes.length < 2) {
    return 'var(--color-silver-400)'
  }

  return closes[closes.length - 1] >= closes[0] ? '#34d399' : '#fb7185'
}
