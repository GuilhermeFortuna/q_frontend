import { describe, expect, it } from 'vitest'

import { analyticsRefetchInterval, optimizeKeys } from '@/api/queries/optimize'

describe('analyticsRefetchInterval', () => {
  it('polls on an interval while the study is running', () => {
    expect(analyticsRefetchInterval(true)).toBe(2500)
  })

  it('stops polling once the study is no longer running', () => {
    expect(analyticsRefetchInterval(false)).toBe(false)
  })
})

describe('optimizeKeys.analytics', () => {
  it('namespaces the analytics query by study id', () => {
    expect(optimizeKeys.analytics('abc')).toEqual(['optimize', 'analytics', 'abc'])
  })
})
