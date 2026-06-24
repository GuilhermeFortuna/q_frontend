import { OBJECTIVE_MODES } from '@/components/optimize/optimizeFormShared'
import { formatConfigSummaryRange } from '@/lib/backtesting/configSummary'
import type { OptimizeConfigFields } from '@/lib/optimize/useOptimizeConfig'
import type { StrategyInfo } from '@/types/strategies'

function mergedSearchSpaceDigest(
  fields: OptimizeConfigFields,
): OptimizeConfigFields['entrySearchSpaces'][string] {
  const primarySlot = fields.entries[0]?.slotId
  const entrySpace = primarySlot ? (fields.entrySearchSpaces[primarySlot] ?? {}) : {}
  return { ...entrySpace, ...fields.exitSearchSpace }
}

export function formatOptimizeSearchSpaceDigest(
  strategyInfo: StrategyInfo | undefined,
  searchSpace: OptimizeConfigFields['entrySearchSpaces'][string],
): string {
  if (!strategyInfo) return 'no params'

  const numericValues = strategyInfo.params
    .filter((spec) => spec.type === 'int' || spec.type === 'float')
    .slice(0, 4)
    .map((spec) => {
      const field = searchSpace[spec.name]
      if (!field || field.kind === 'categorical') return '?'
      return `${field.low}–${field.high}`
    })

  if (numericValues.length >= 2) {
    return numericValues.join('/')
  }
  if (numericValues.length === 1) {
    return numericValues[0]
  }

  return strategyInfo.params.length === 0 ? 'no params' : `${strategyInfo.params.length} params`
}

export function formatOptimizeSetupTeaserSummary(
  fields: OptimizeConfigFields,
  strategyInfo: StrategyInfo | undefined,
): {
  strategyLabel: string
  paramsDigest: string
  symbol: string
  timeframe: string
  range: string
  capital: string
  studyDigest: string
} {
  const strategyLabel =
    fields.entries.length > 1
      ? `${fields.entries.length} entries (${entryManagerLabel(fields.entryManager.kind)})`
      : (strategyInfo?.label ?? fields.strategy)
  const timeframe = fields.engine === 'tick' ? fields.displayTimeframe : fields.timeframe
  const capital = fields.capital.toLocaleString('en-US')
  const objectiveLabel =
    OBJECTIVE_MODES.find((entry) => entry.value === fields.objective)?.label ?? fields.objective

  return {
    strategyLabel,
    paramsDigest: formatOptimizeSearchSpaceDigest(strategyInfo, mergedSearchSpaceDigest(fields)),
    symbol: fields.symbol,
    timeframe,
    range: formatConfigSummaryRange(fields.startDate, fields.endDate),
    capital,
    studyDigest: `${objectiveLabel} · ${fields.nTrials} trials`,
  }
}

function entryManagerLabel(kind: string): string {
  if (kind === 'and') return 'AND'
  if (kind === 'majority') return 'Majority'
  return 'OR'
}
