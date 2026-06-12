import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { formatConfigSummaryRange } from '@/lib/backtesting/configSummary'
import type { BacktestRequest } from '@/types/backtesting'
import type { StrategyInfo } from '@/types/strategies'

type BacktestConfigSummaryStripProps = {
  request: BacktestRequest
  strategyInfo: StrategyInfo | undefined
  onEditSetup: () => void
}

function formatParamsDigest(
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

export function BacktestConfigSummaryStrip({
  request,
  strategyInfo,
  onEditSetup,
}: BacktestConfigSummaryStripProps) {
  const strategyLabel = strategyInfo?.label ?? request.strategy ?? '—'
  const symbol = request.symbol
  const timeframe =
    request.engine === 'tick' ? (request.display_timeframe ?? 'M1') : (request.timeframe ?? 'D1')
  const range =
    request.start && request.end
      ? formatConfigSummaryRange(new Date(request.start), new Date(request.end))
      : '—'
  const capital = request.initial_capital != null ? format(request.initial_capital, '#,##0') : '—'
  const paramsDigest = formatParamsDigest(request, strategyInfo)

  return (
    <div className="border-carbon-600/50 bg-carbon-950/40 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2">
      <p className="text-silver-300 min-w-0 text-xs leading-relaxed">
        <span className="text-brass-400 font-semibold">{strategyLabel}</span>
        <span className="text-silver-500"> · </span>
        {paramsDigest}
        <span className="text-silver-500"> · </span>
        {symbol}
        <span className="text-silver-500"> · </span>
        {timeframe}
        <span className="text-silver-500"> · </span>
        {range}
        <span className="text-silver-500"> · </span>${capital}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onEditSetup}>
        Edit setup
      </Button>
    </div>
  )
}
