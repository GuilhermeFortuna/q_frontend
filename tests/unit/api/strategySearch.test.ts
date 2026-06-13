import { describe, expect, it } from 'vitest'

import { formatEfficiencyRatio } from '@/lib/walkforward/objectiveMetric'
import {
  isStrategySearchTerminalStatus,
  shouldFetchStrategySearchResults,
} from '@/types/strategySearch'

describe('strategySearch polling helpers', () => {
  it('treats completed and cancelled as terminal', () => {
    expect(isStrategySearchTerminalStatus('completed')).toBe(true)
    expect(isStrategySearchTerminalStatus('cancelled')).toBe(true)
    expect(isStrategySearchTerminalStatus('running')).toBe(false)
  })

  it('fetches results only for completed or cancelled runs', () => {
    expect(shouldFetchStrategySearchResults('completed')).toBe(true)
    expect(shouldFetchStrategySearchResults('cancelled')).toBe(true)
    expect(shouldFetchStrategySearchResults('running')).toBe(false)
  })
})

describe('formatEfficiencyRatio for leaderboard', () => {
  it('formats numeric efficiency', () => {
    expect(formatEfficiencyRatio(0.68)).toBe('0.68')
  })

  it('returns em dash for null efficiency', () => {
    expect(formatEfficiencyRatio(null)).toBe('—')
  })
})
