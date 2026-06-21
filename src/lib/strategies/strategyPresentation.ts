import type { StrategyCategory, StrategyInfo } from '@/types/strategies'

export type BacktestEngine = 'candle' | 'tick'

export function strategyEngine(info: StrategyInfo): BacktestEngine {
  return info.engine ?? 'candle'
}

export const STRATEGY_CATEGORY_LABELS: Record<StrategyCategory, string> = {
  trend: 'Trend',
  mean_reversion: 'Mean reversion',
  breakout: 'Breakout',
  momentum: 'Momentum',
  other: 'Other',
}

export const STRATEGY_CATEGORY_ORDER: StrategyCategory[] = [
  'trend',
  'mean_reversion',
  'breakout',
  'momentum',
  'other',
]

export function strategyCategory(info: StrategyInfo): StrategyCategory {
  return info.category ?? 'other'
}

export function strategyThesis(info: StrategyInfo): string {
  const thesis = info.thesis?.trim()
  if (thesis) return thesis
  return info.description
}

export function strategyCardDescription(info: StrategyInfo): string {
  return info.description
}

export function paramHint(spec: { hint?: string | null }): string | null {
  const hint = spec.hint?.trim()
  return hint || null
}

export function categoryLabel(category: StrategyCategory): string {
  return STRATEGY_CATEGORY_LABELS[category]
}

export const CUSTOM_STRATEGY_CATEGORY_LABEL = 'Saved'

export function isCustomStrategy(
  strategyName: string,
  customStrategyNames: ReadonlySet<string>,
): boolean {
  return customStrategyNames.has(strategyName)
}

export function strategyOptionLabel(
  strategy: StrategyInfo,
  customStrategyNames: ReadonlySet<string>,
): string {
  return isCustomStrategy(strategy.name, customStrategyNames)
    ? `${strategy.label} — custom`
    : strategy.label
}
