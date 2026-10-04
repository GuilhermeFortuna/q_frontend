import type { StrategyInfo } from '@/types/strategies'

export const ML_FILTER_STRATEGY = 'MACrossoverMLFilter'

/**
 * Research-only strategies stay out of Optimize, Validate, Discover and live paths. The
 * registry reports this as a `research_only` capability; the boolean flags are the generated
 * contract's spelling of the same fact.
 */
export function isResearchOnlyStrategy(info: StrategyInfo): boolean {
  return (
    info.capabilities?.includes('research_only') === true ||
    info.research_only === true ||
    info.supports_optimization === false ||
    info.supports_walkforward === false ||
    info.supports_discovery === false
  )
}

export function isMlEntryFilterStrategy(
  info: Pick<StrategyInfo, 'name' | 'capabilities'>,
): boolean {
  return info.capabilities?.includes('ml_entry_filter') === true || info.name === ML_FILTER_STRATEGY
}
