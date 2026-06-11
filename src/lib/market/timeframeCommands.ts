export type TimeframeCommand = {
  label: string
  value: string
}

export function parseTimeframeInput(input: string): TimeframeCommand | null {
  const clean = input.trim().toLowerCase()

  const minMatch = clean.match(/^(\d+)\s*(min|m|minutes?)$/)
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10)
    if (mins === 1) return { label: 'Switch to 1 Minute', value: '1m' }
    if (mins === 5) return { label: 'Switch to 5 Minutes', value: '5m' }
    if (mins === 15) return { label: 'Switch to 15 Minutes', value: '15m' }
    if (mins === 30) return { label: 'Switch to 30 Minutes', value: '30m' }
    if (mins === 60) return { label: 'Switch to 1 Hour', value: '1H' }
    if (mins === 240) return { label: 'Switch to 4 Hours', value: '4H' }
  }

  const hourMatch = clean.match(/^(\d+)\s*(h|hours?)$/)
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10)
    if (hours === 1) return { label: 'Switch to 1 Hour', value: '1H' }
    if (hours === 4) return { label: 'Switch to 4 Hours', value: '4H' }
  }

  const dayMatch = clean.match(/^(\d+)\s*(d|days?)$/) || (clean === 'daily' ? [null, '1'] : null)
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10)
    if (days === 1) return { label: 'Switch to 1 Day (Daily)', value: '1D' }
  }

  if (clean === '1m') return { label: 'Switch to 1 Minute', value: '1m' }
  if (clean === '5m') return { label: 'Switch to 5 Minutes', value: '5m' }
  if (clean === '15m') return { label: 'Switch to 15 Minutes', value: '15m' }
  if (clean === '30m') return { label: 'Switch to 30 Minutes', value: '30m' }
  if (clean === '1h' || clean === '60m') return { label: 'Switch to 1 Hour', value: '1H' }
  if (clean === '4h' || clean === '240m') return { label: 'Switch to 4 Hours', value: '4H' }
  if (clean === '1d' || clean === 'daily') return { label: 'Switch to 1 Day (Daily)', value: '1D' }

  const numMatch = clean.match(/^(\d+)$/)
  if (numMatch) {
    const num = parseInt(numMatch[1], 10)
    if (num === 1) return { label: 'Switch to 1 Minute', value: '1m' }
    if (num === 5) return { label: 'Switch to 5 Minutes', value: '5m' }
    if (num === 15) return { label: 'Switch to 15 Minutes', value: '15m' }
    if (num === 30) return { label: 'Switch to 30 Minutes', value: '30m' }
    if (num === 60) return { label: 'Switch to 1 Hour', value: '1H' }
    if (num === 240) return { label: 'Switch to 4 Hours', value: '4H' }
  }

  return null
}
