import { format } from 'date-fns'

import type { BacktestRequest } from '@/types/backtesting'
import type { StrategyInfo } from '@/types/strategies'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import type { BacktestConfigFields } from '@/lib/backtesting/useBacktestConfig'

export function formatConfigSummaryRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, 'yyyy-MM-dd')} → ${format(endDate, 'yyyy-MM-dd')}`
}

export function formatShortParamsDigest(
  strategyInfo: StrategyInfo | undefined,
  strategyParams: Record<string, StrategyParamValue>,
): string {
  if (!strategyInfo) return 'no params'

  const numericValues = strategyInfo.params
    .filter((spec) => spec.type === 'int' || spec.type === 'float')
    .slice(0, 4)
    .map((spec) => String(strategyParams[spec.name] ?? spec.default))

  if (numericValues.length >= 2) {
    return numericValues.join('/')
  }
  if (numericValues.length === 1) {
    return numericValues[0]
  }

  return strategyInfo.params.length === 0 ? 'no params' : `${strategyInfo.params.length} params`
}

export function formatParamsDigestFromRequest(
  request: BacktestRequest,
  strategyInfo: StrategyInfo | undefined,
): string {
  const params = request.strategy_params ?? {}
  const keys = strategyInfo?.params.map((p) => p.name) ?? Object.keys(params)
  if (keys.length === 0) return 'no params'

  return keys
    .slice(0, 4)
    .map((key) => {
      const spec = strategyInfo?.params.find((p) => p.name === key)
      const label = spec?.label ?? key
      const value = params[key]
      return `${label}=${String(value)}`
    })
    .join(', ')
}

export function formatSetupTeaserSummary(
  fields: BacktestConfigFields,
  strategyInfo: StrategyInfo | undefined,
): {
  strategyLabel: string
  paramsDigest: string
  symbol: string
  timeframe: string
  range: string
  capital: string
} {
  const strategyLabel = strategyInfo?.label ?? fields.strategy
  const timeframe = fields.engine === 'tick' ? fields.displayTimeframe : fields.timeframe
  const capital = fields.capital.toLocaleString('en-US')
  const entryParams = fields.entries?.[0]?.params ?? fields.strategyParams

  return {
    strategyLabel,
    paramsDigest: formatShortParamsDigest(strategyInfo, entryParams),
    symbol: fields.symbol,
    timeframe,
    range: formatConfigSummaryRange(fields.startDate, fields.endDate),
    capital,
  }
}
