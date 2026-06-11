import { describe, expect, it } from 'vitest'

import { closesToPath } from '@/lib/market/sparkline'

describe('closesToPath', () => {
  it('returns an empty path for no data', () => {
    expect(closesToPath([], 56, 16)).toBe('')
  })

  it('draws a flat line for a single point', () => {
    expect(closesToPath([100], 56, 16)).toBe('M 0 8 L 56 8')
  })

  it('draws a flat horizontal path when all closes are equal', () => {
    const path = closesToPath([10, 10, 10, 10], 56, 16)
    expect(path.startsWith('M 0.00,16.00')).toBe(true)
    expect(path.endsWith('L 56.00,16.00')).toBe(true)
  })

  it('draws a rising path from low to high y values', () => {
    const path = closesToPath([10, 20, 30], 60, 20)
    expect(path).toContain('M 0.00,20.00')
    expect(path).toContain('L 60.00,0.00')
  })

  it('draws a falling path from high to low y values', () => {
    const path = closesToPath([30, 20, 10], 60, 20)
    expect(path).toContain('M 0.00,0.00')
    expect(path).toContain('L 60.00,20.00')
  })
})
