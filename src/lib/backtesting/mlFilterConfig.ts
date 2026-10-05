import { addDays, endOfDay, startOfDay } from 'date-fns'

import { splitParamsByPartition } from '@/lib/backtesting/entryInstances'
import { formatExchangeLabel } from '@/lib/mlFilters/mlFilterForm'
import { ML_FILTER_STRATEGY } from '@/lib/strategies/strategyCapabilities'
import type { BacktestRequest } from '@/types/backtesting'
import type { StrategyInfo } from '@/types/strategies'
import type { MlFilterModelSummary } from '../../../contracts/api'

export const DEFAULT_ML_FILTER_THRESHOLD = 0.5

export type MlFilterFormState = {
  modelVersionId: string | null
  threshold: number
}

export function defaultMlFilterFormState(): MlFilterFormState {
  return { modelVersionId: null, threshold: DEFAULT_ML_FILTER_THRESHOLD }
}

// ---------------------------------------------------------------------------
// Baseline semantics
// ---------------------------------------------------------------------------

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/**
 * The part of a backtest configuration a model was trained against: symbol, timeframe,
 * MA parameters, exits, costs, sizing and day-trade scheduling. Dates and capital are free.
 */
export function mlFilterSemanticSnapshot(
  request: BacktestRequest,
  strategies: StrategyInfo[],
): Record<string, unknown> {
  const specs =
    strategies.find((info) => info.name === ML_FILTER_STRATEGY)?.params ??
    strategies.find((info) => info.name === 'MACrossover')?.params ??
    []
  const single = request.entries?.length === 1 ? request.entries[0] : null
  const merged = single
    ? { ...single.params, ...(request.exit_params ?? {}) }
    : { ...(request.strategy_params ?? {}), ...(request.exit_params ?? {}) }
  const { entryParams, exitParams } = splitParamsByPartition(specs, merged)
  const dayTrade = Boolean(request.day_trade)
  return {
    symbol: request.symbol,
    timeframe: request.timeframe,
    ma_parameters: entryParams,
    exits: exitParams,
    costs: request.costs ?? { cost_per_contract: 0, cost_bps: 0 },
    // Stored API requests include defaults that form payloads may omit.
    // Compare their effective scaling behavior rather than field presence.
    position_sizing: request.position_sizing
      ? {
          ...request.position_sizing,
          scale_by_signal_strength: request.position_sizing.scale_by_signal_strength ?? false,
        }
      : null,
    point_value: request.point_value ?? null,
    day_trade: dayTrade,
    ...(dayTrade
      ? {
          day_trade_start_time: request.day_trade_start_time,
          day_trade_end_time: request.day_trade_end_time,
          day_trade_close_time: request.day_trade_close_time,
        }
      : {}),
  }
}

const SNAPSHOT_LABELS: Record<string, string> = {
  symbol: 'symbol',
  timeframe: 'timeframe',
  ma_parameters: 'MA parameters',
  exits: 'exits',
  costs: 'costs',
  position_sizing: 'position sizing',
  point_value: 'point value',
  day_trade: 'day-trade scheduling',
  day_trade_start_time: 'day-trade scheduling',
  day_trade_end_time: 'day-trade scheduling',
  day_trade_close_time: 'day-trade scheduling',
}

/** Human labels of the baseline settings the current request no longer matches. */
export function diffMlFilterBaseline(
  baseline: BacktestRequest,
  current: BacktestRequest,
  strategies: StrategyInfo[],
): string[] {
  const a = mlFilterSemanticSnapshot(baseline, strategies)
  const b = mlFilterSemanticSnapshot(current, strategies)
  const labels = new Set<string>()
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (stable(a[key]) !== stable(b[key])) labels.add(SNAPSHOT_LABELS[key] ?? key)
  }
  return [...labels]
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** First calendar day whose start is at or after the model's training end. */
export function earliestBacktestStart(trainEnd: string): Date {
  const instant = new Date(trainEnd)
  const dayStart = startOfDay(instant)
  return dayStart.getTime() >= instant.getTime() ? dayStart : addDays(dayStart, 1)
}

/** Request start is the start of the selected day; it must not precede the training end. */
export function backtestOverlapsTraining(startDate: Date, trainEnd: string): boolean {
  return startOfDay(startDate).getTime() < new Date(trainEnd).getTime()
}

// ---------------------------------------------------------------------------
// Variant request built from a model's baseline run
// ---------------------------------------------------------------------------

export function buildMlFilterBacktestConfig({
  source,
  trainEnd,
  modelVersionId,
  threshold = DEFAULT_ML_FILTER_THRESHOLD,
  now = new Date(),
}: {
  source: BacktestRequest
  trainEnd: string
  modelVersionId: string
  threshold?: number
  now?: Date
}): BacktestRequest {
  const single = source.entries?.length === 1 ? source.entries[0] : null
  const params = single
    ? { ...single.params, ...(source.exit_params ?? {}) }
    : { ...(source.strategy_params ?? {}), ...(source.exit_params ?? {}) }
  const start = earliestBacktestStart(trainEnd)
  const sourceEnd = source.end ? new Date(source.end) : null
  const end = sourceEnd && sourceEnd > start ? sourceEnd : endOfDay(now)

  const { entries: _entries, entry_manager: _manager, exit_params: _exits, ...rest } = source
  void _entries
  void _manager
  void _exits
  return {
    ...rest,
    strategy: ML_FILTER_STRATEGY,
    strategy_params: params,
    start: start.toISOString(),
    end: end.toISOString(),
    ml_filter: { model_version_id: modelVersionId, threshold },
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type MlFilterModelStatus =
  | 'none'
  | 'loading'
  | 'missing'
  | 'corrupt'
  | 'incompatible'
  | 'ready'

export type MlFilterModelContext = {
  status: MlFilterModelStatus
  summary: MlFilterModelSummary | null
  /** Server reasons for `incompatible`, or the server message for `corrupt`. */
  reasons: string[]
  /** Baseline run config, when it could be loaded. */
  baseline: BacktestRequest | null
  baselineLoading: boolean
}

export type MlFilterValidation = {
  /** True only when the ML variant is selected. */
  active: boolean
  blocking: boolean
  errors: {
    model?: string
    threshold?: string
    dates?: string
    composition?: string
    baseline?: string
  }
}

export const INACTIVE_ML_FILTER_VALIDATION: MlFilterValidation = {
  active: false,
  blocking: false,
  errors: {},
}

export function validateMlFilterConfig({
  strategy,
  entryCount,
  entryManagerKind,
  engine,
  startDate,
  form,
  context,
  baselineDiff,
}: {
  strategy: string
  entryCount: number
  entryManagerKind: string
  engine: 'candle' | 'tick'
  startDate: Date
  form: MlFilterFormState
  context: MlFilterModelContext
  baselineDiff: string[]
}): MlFilterValidation {
  if (strategy !== ML_FILTER_STRATEGY) return INACTIVE_ML_FILTER_VALIDATION
  const errors: MlFilterValidation['errors'] = {}

  if (engine !== 'candle' || entryCount !== 1 || entryManagerKind !== 'or') {
    errors.composition =
      'MA Crossover · ML Filter supports exactly one candle entry combined with “or”. Remove extra entries, use the candle engine, or switch back to MA Crossover.'
  }

  if (!form.modelVersionId) {
    errors.model = 'Select a saved model version.'
  } else if (context.status === 'loading') {
    errors.model = 'Loading the selected model version…'
  } else if (context.status === 'missing') {
    errors.model = `Model version ${form.modelVersionId} was not found. Choose another compatible version.`
  } else if (context.status === 'corrupt') {
    errors.model = `Model version ${form.modelVersionId} cannot be loaded${context.reasons.length ? `: ${context.reasons.join(' ')}` : '.'} Choose another compatible version.`
  } else if (context.status === 'incompatible') {
    errors.model = `Model version ${form.modelVersionId} is not usable${context.reasons.length ? `: ${context.reasons.join(' ')}` : '.'}`
  }

  if (Number.isNaN(form.threshold) || form.threshold < 0 || form.threshold > 1) {
    errors.threshold = 'Threshold must be between 0 and 1.'
  }

  if (context.status === 'ready' && context.summary?.train_end) {
    if (backtestOverlapsTraining(startDate, context.summary.train_end)) {
      errors.dates = `Backtest start overlaps the model's training data (training ends ${formatExchangeLabel(context.summary.train_end)}). Start on or after ${formatDay(earliestBacktestStart(context.summary.train_end))}.`
    }
  }

  if (context.status === 'ready' && baselineDiff.length > 0) {
    errors.baseline = `The configuration no longer matches the model's baseline (${baselineDiff.join(', ')}). Restore those values or choose another compatible model version.`
  }

  return { active: true, blocking: Object.keys(errors).length > 0, errors }
}

function formatDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}
