import { describe, expect, it } from 'vitest'

import { formatEfficiencyRatio, objectiveMetricValue } from '@/lib/walkforward/objectiveMetric'
import { shouldFetchWalkForwardResults, isWalkForwardTerminalStatus } from '@/types/walkforward'

describe('walkforward polling helpers', () => {
  it('treats completed and cancelled as terminal', () => {
    expect(isWalkForwardTerminalStatus('completed')).toBe(true)
    expect(isWalkForwardTerminalStatus('cancelled')).toBe(true)
    expect(isWalkForwardTerminalStatus('running')).toBe(false)
  })

  it('fetches results only for completed or cancelled runs', () => {
    expect(shouldFetchWalkForwardResults('completed')).toBe(true)
    expect(shouldFetchWalkForwardResults('cancelled')).toBe(true)
    expect(shouldFetchWalkForwardResults('running')).toBe(false)
  })
})

describe('objectiveMetricValue', () => {
  it('reads return_drawdown_ratio for maximize_return_drawdown', () => {
    expect(objectiveMetricValue({ return_drawdown_ratio: 1.25 }, 'maximize_return_drawdown')).toBe(
      1.25,
    )
  })
})

describe('formatEfficiencyRatio', () => {
  it('formats numeric efficiency', () => {
    expect(formatEfficiencyRatio(0.625)).toBe('0.63')
  })

  it('returns em dash for null efficiency', () => {
    expect(formatEfficiencyRatio(null)).toBe('—')
  })
})
