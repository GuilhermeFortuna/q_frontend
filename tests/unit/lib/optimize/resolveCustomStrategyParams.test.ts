import { describe, expect, it } from 'vitest'

import {
  resolveCustomStrategyParams,
  withResolvedCustomStrategyParams,
} from '@/lib/strategies/resolveCustomStrategyParams'
import { partitionStrategyParamSpecs } from '@/workspaces/strategy/exitWorkbenchGroups'
import { mockStrategies } from '@/mocks/data'
import type { StrategyInfo } from '@/types/strategies'
import {
  mockMaCrossoverWithExits,
  mockOptimizeCustomSaved,
  mockOptimizeCustomStrategy,
  strategiesWithCustomCustom,
} from '../../fixtures/optimizeCustomStrategyFixtures'

describe('resolveCustomStrategyParams', () => {
  const strategies = strategiesWithCustomCustom().strategies

  it('returns API specs when a custom already has full optimizable params', () => {
    const resolved = resolveCustomStrategyParams(mockOptimizeCustomStrategy, strategies, [
      mockOptimizeCustomSaved,
    ])

    expect(resolved).toHaveLength(mockOptimizeCustomStrategy.params.length)
    expect(resolved.find((param) => param.name === 'stop_loss_pct')?.exit_group).toBe('stop_loss')
  })

  it('merges base specs when a custom only carries saved scalar values', () => {
    const strategies = [...mockStrategies.strategies, mockMaCrossoverWithExits]
    const sparseCustom: StrategyInfo = {
      name: 'MyCustomMA',
      label: 'MyCustomMA',
      description: 'Sparse custom',
      params: [
        { name: 'short_period', label: 'Short Period', type: 'int', default: 20 },
        { name: 'long_period', label: 'Long Period', type: 'int', default: 100 },
      ],
    }

    const resolved = resolveCustomStrategyParams(sparseCustom, strategies, [
      mockOptimizeCustomSaved,
    ])
    const { entryParamSpecs, exitParamSpecs } = partitionStrategyParamSpecs(resolved)

    expect(entryParamSpecs.length).toBeGreaterThan(0)
    expect(exitParamSpecs.length).toBeGreaterThan(0)
    expect(resolved.find((param) => param.name === 'trailing_stop_pct')?.min).not.toBeUndefined()
  })

  it('withResolvedCustomStrategyParams preserves the custom name', () => {
    const resolved = withResolvedCustomStrategyParams(mockOptimizeCustomStrategy, strategies, [
      mockOptimizeCustomSaved,
    ])

    expect(resolved.name).toBe('MyCustomMA')
    expect(resolved.params.length).toBeGreaterThan(mockOptimizeCustomStrategy.params.length - 2)
  })
})
