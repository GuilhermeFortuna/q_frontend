import { describe, expect, it } from 'vitest'

import { defaultEntryManager } from '@/lib/backtesting/entryInstances'
import { formatSetupTeaserSummary, formatShortParamsDigest } from '@/lib/backtesting/configSummary'
import type { BacktestConfigFields } from '@/lib/backtesting/useBacktestConfig'
import type { StrategyInfo } from '@/types/strategies'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import {
  defaultPositionSizingFields,
  type PositionSizingMode,
} from '@/lib/backtesting/positionSizing'
import { defaultTransactionCostFields } from '@/lib/backtesting/transactionCosts'

const maStrategy: StrategyInfo = {
  name: 'MACrossover',
  label: 'MA Crossover',
  description: 'Short/long moving-average crossover.',
  params: [
    { name: 'short_period', label: 'Short Period', type: 'int', default: 50 },
    { name: 'long_period', label: 'Long Period', type: 'int', default: 200 },
  ],
}

const baseFields: BacktestConfigFields = {
  symbol: 'PETR4',
  timeframe: 'D1',
  startDate: defaultBacktestStart,
  endDate: defaultBacktestEnd,
  capital: 100000,
  pointValue: 1,
  sizingMode: 'fixed_quantity' as PositionSizingMode,
  positionSizingFields: defaultPositionSizingFields(),
  costFields: defaultTransactionCostFields(),
  strategy: 'MACrossover',
  strategyParams: {},
  entries: [
    {
      slotId: 'entry-1',
      strategy: 'MACrossover',
      params: { short_period: 50, long_period: 200 },
    },
  ],
  entryManager: defaultEntryManager(),
  dayTrade: false,
  dayTradeStartTime: '09:00',
  dayTradeEndTime: '16:00',
  dayTradeCloseTime: '17:00',
  engine: 'candle',
  displayTimeframe: 'M1',
  tickFlags: 'all',
}

describe('configSummary', () => {
  it('formats short numeric params as slash-separated values', () => {
    expect(formatShortParamsDigest(maStrategy, { short_period: 12, long_period: 48 })).toBe('12/48')
  })

  it('builds live setup teaser summary from current fields', () => {
    const summary = formatSetupTeaserSummary(
      {
        ...baseFields,
        entries: [
          {
            slotId: 'entry-1',
            strategy: 'MACrossover',
            params: { short_period: 12, long_period: 48 },
          },
        ],
      },
      maStrategy,
    )
    expect(summary.strategyLabel).toBe('MA Crossover')
    expect(summary.paramsDigest).toBe('12/48')
    expect(summary.symbol).toBe('PETR4')
    expect(summary.capital).toBe('100,000')
  })
})
