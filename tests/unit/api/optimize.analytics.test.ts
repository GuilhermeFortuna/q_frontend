import { describe, expect, it } from 'vitest'

import { analyticsRefetchInterval } from '@/api/queries/optimize'

describe('useOptimizationAnalytics polling', () => {
  it('polls while running or pending', () => {
    expect(analyticsRefetchInterval(true)).toBe(2500)
  })

  it('stops polling when the study is terminal', () => {
    expect(analyticsRefetchInterval(false)).toBe(false)
  })
})
