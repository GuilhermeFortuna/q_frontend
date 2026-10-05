import { describe, expect, it } from 'vitest'

import { diffMlFilterBaseline } from '@/lib/backtesting/mlFilterConfig'
import {
  buildPositionSizingPayload,
  hydratePositionSizingFields,
} from '@/lib/backtesting/positionSizing'
import type { BacktestRequest, PositionSizingConfig } from '@/types/backtesting'

const sizingConfigs: PositionSizingConfig[] = [
  { type: 'fixed_quantity', quantity: 1 },
  {
    type: 'fixed_safety_margin',
    safety_margin_per_contract: 5000,
    min_contracts: 1,
    max_contracts: null,
  },
  {
    type: 'inverse_volatility',
    target_volatility_pct: 10,
    min_contracts: 0,
    max_contracts: null,
  },
]

function request(position_sizing: PositionSizingConfig): BacktestRequest {
  return { symbol: 'CCM$', timeframe: 'H1', strategy: 'MACrossover', position_sizing }
}

describe('ML filter position sizing compatibility', () => {
  it.each(sizingConfigs)('accepts an omitted false scaling default for $type', (sizing) => {
    const stored = { ...sizing, scale_by_signal_strength: false }
    expect(diffMlFilterBaseline(request(stored), request(sizing), [])).toEqual([])
    expect(diffMlFilterBaseline(request(sizing), request(stored), [])).toEqual([])
  })

  it.each(sizingConfigs)('preserves signal-strength sizing when restoring $type', (sizing) => {
    const stored = { ...sizing, scale_by_signal_strength: true }
    const hydrated = hydratePositionSizingFields(stored)
    const payload = buildPositionSizingPayload(hydrated.mode, hydrated.fields)

    expect(payload).toEqual(stored)
    expect(diffMlFilterBaseline(request(stored), request(payload), [])).toEqual([])
  })

  it.each(sizingConfigs)('rejects a real scaling difference for $type', (sizing) => {
    const scaled = { ...sizing, scale_by_signal_strength: true }
    expect(diffMlFilterBaseline(request(scaled), request(sizing), [])).toEqual(['position sizing'])
  })

  it('rejects a different fixed quantity', () => {
    expect(
      diffMlFilterBaseline(
        request({ type: 'fixed_quantity', quantity: 1 }),
        request({ type: 'fixed_quantity', quantity: 2 }),
        [],
      ),
    ).toEqual(['position sizing'])
  })
})
