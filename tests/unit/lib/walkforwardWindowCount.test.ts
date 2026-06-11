import { describe, expect, it } from 'vitest'

import { estimateWalkForwardWindowCount } from '@/lib/walkforward/windowCount'

describe('estimateWalkForwardWindowCount', () => {
  it('counts windows using calendar-day offsets like the backend splitter', () => {
    const start = new Date('2024-01-01T00:00:00Z')
    const end = new Date('2024-12-31T00:00:00Z')
    const trainDays = 180
    const testDays = 30

    expect(estimateWalkForwardWindowCount(start, end, trainDays, testDays)).toBe(7)
  })

  it('returns zero when range is shorter than train window', () => {
    const start = new Date('2024-01-01T00:00:00Z')
    const end = new Date('2024-03-01T00:00:00Z')
    expect(estimateWalkForwardWindowCount(start, end, 180, 30)).toBe(0)
  })
})
