import { DISPLAY_TIMEZONE } from '@/lib/formatDate'
import type {
  MlFilterAlgorithm,
  MlFilterAlgorithmHyperparams,
  MlFilterFeatureName,
  MlFilterTrainingRequest,
} from '../../../contracts/api'

/** Q-085 allowlist order; request feature order is significant and always follows it. */
export const ML_FILTER_FEATURE_ORDER: readonly MlFilterFeatureName[] = [
  'open',
  'high',
  'low',
  'close',
  'tick_volume',
  'real_volume',
  'ma_short',
  'ma_long',
  'delta',
  'prev_delta',
  'side',
]

export const ML_FILTER_MANDATORY_FEATURE: MlFilterFeatureName = 'side'

export const ML_FILTER_FEATURE_LABELS: Record<MlFilterFeatureName, string> = {
  open: 'Open',
  high: 'High',
  low: 'Low',
  close: 'Close',
  tick_volume: 'Tick volume',
  real_volume: 'Real volume',
  ma_short: 'Short MA',
  ma_long: 'Long MA',
  delta: 'MA delta',
  prev_delta: 'Previous MA delta',
  side: 'Signal side (mandatory)',
}

export const ML_FILTER_ALGORITHMS: ReadonlyArray<{ value: MlFilterAlgorithm; label: string }> = [
  { value: 'lightgbm', label: 'LightGBM' },
  { value: 'random_forest', label: 'Random Forest' },
  { value: 'logistic_regression', label: 'Logistic regression' },
]

export const ML_FILTER_DEFAULT_ALGORITHMS: MlFilterAlgorithm[] = [
  'lightgbm',
  'random_forest',
  'logistic_regression',
]

export const ML_FILTER_DEFAULT_SEED = 42
export const ML_FILTER_DEFAULT_THRESHOLD = 0.5

export function algorithmLabel(algorithm: MlFilterAlgorithm): string {
  return ML_FILTER_ALGORITHMS.find((item) => item.value === algorithm)?.label ?? algorithm
}

// ---------------------------------------------------------------------------
// Hyperparameters (Q-086 defaults and validation bounds)
// ---------------------------------------------------------------------------

export type HyperparamSpec = {
  key: string
  label: string
  defaultValue: number | null
  min?: number
  max: number
  integer: boolean
  /** Value must be strictly greater than `min`. */
  exclusiveMin?: boolean
  /** An empty field means "no limit" (null). */
  nullable?: boolean
}

export const ML_FILTER_PARAM_SPECS: Record<MlFilterAlgorithm, HyperparamSpec[]> = {
  lightgbm: [
    { key: 'n_estimators', label: 'Trees', defaultValue: 100, min: 1, max: 2000, integer: true },
    {
      key: 'learning_rate',
      label: 'Learning rate',
      defaultValue: 0.1,
      min: 0,
      max: 1,
      integer: false,
      exclusiveMin: true,
    },
    { key: 'num_leaves', label: 'Leaves', defaultValue: 31, min: 2, max: 256, integer: true },
  ],
  random_forest: [
    { key: 'n_estimators', label: 'Trees', defaultValue: 200, min: 1, max: 2000, integer: true },
    {
      key: 'max_depth',
      label: 'Max depth (blank = unlimited)',
      defaultValue: null,
      min: 1,
      max: 100,
      integer: true,
      nullable: true,
    },
    {
      key: 'min_samples_leaf',
      label: 'Min samples per leaf',
      defaultValue: 1,
      min: 1,
      max: 100,
      integer: true,
    },
  ],
  logistic_regression: [
    {
      key: 'C',
      label: 'Inverse regularization (C)',
      defaultValue: 1,
      min: 0,
      max: 1_000_000,
      integer: false,
      exclusiveMin: true,
    },
    {
      key: 'max_iter',
      label: 'Max iterations',
      defaultValue: 1000,
      min: 100,
      max: 10_000,
      integer: true,
    },
  ],
}

export type HyperparamDraft = Record<MlFilterAlgorithm, Record<string, number | null>>

export function defaultHyperparamDraft(): HyperparamDraft {
  const draft = {} as HyperparamDraft
  for (const algorithm of Object.keys(ML_FILTER_PARAM_SPECS) as MlFilterAlgorithm[]) {
    draft[algorithm] = Object.fromEntries(
      ML_FILTER_PARAM_SPECS[algorithm].map((spec) => [spec.key, spec.defaultValue]),
    )
  }
  return draft
}

export function hyperparamErrorKey(algorithm: MlFilterAlgorithm, key: string): string {
  return `${algorithm}.${key}`
}

function validateSpec(spec: HyperparamSpec, value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return spec.nullable ? null : `${spec.label} is required.`
  }
  if (spec.integer && !Number.isInteger(value)) return `${spec.label} must be a whole number.`
  if (spec.min !== undefined) {
    if (spec.exclusiveMin ? value <= spec.min : value < spec.min) {
      return `${spec.label} must be ${spec.exclusiveMin ? 'greater than' : 'at least'} ${spec.min}.`
    }
  }
  if (value > spec.max) return `${spec.label} must be at most ${spec.max}.`
  return null
}

/** Field errors for the selected algorithms only, keyed by `algorithm.param`. */
export function validateHyperparams(
  algorithms: MlFilterAlgorithm[],
  draft: HyperparamDraft,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const algorithm of algorithms) {
    for (const spec of ML_FILTER_PARAM_SPECS[algorithm]) {
      const error = validateSpec(spec, draft[algorithm][spec.key] ?? null)
      if (error) errors[hyperparamErrorKey(algorithm, spec.key)] = error
    }
  }
  return errors
}

export function buildHyperparameters(
  algorithms: MlFilterAlgorithm[],
  draft: HyperparamDraft,
): MlFilterAlgorithmHyperparams {
  const result: Record<string, Record<string, number | null>> = {}
  for (const algorithm of algorithms) {
    result[algorithm] = { ...draft[algorithm] }
  }
  return result as MlFilterAlgorithmHyperparams
}

export function validateSeed(seed: number): string | null {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295) {
    return 'Seed must be a whole number between 0 and 4294967295.'
  }
  return null
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

export function orderFeatures(selected: Iterable<MlFilterFeatureName>): MlFilterFeatureName[] {
  const set = new Set(selected)
  return ML_FILTER_FEATURE_ORDER.filter((feature) => set.has(feature))
}

/** Server allowlist order, restricted to what the source can provide. */
export function defaultFeatures(available: readonly MlFilterFeatureName[]): MlFilterFeatureName[] {
  return orderFeatures(available)
}

export function validateFeatures(selected: readonly MlFilterFeatureName[]): string | null {
  if (!selected.includes(ML_FILTER_MANDATORY_FEATURE)) {
    return 'Signal side is mandatory.'
  }
  if (selected.length < 2) return 'Select at least one feature besides signal side.'
  return null
}

// ---------------------------------------------------------------------------
// Exchange-time <-> UTC conversion (the UI shows exchange time, requests are UTC)
// ---------------------------------------------------------------------------

const ZONE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function zoneParts(ms: number): {
  y: number
  mo: number
  d: number
  h: number
  mi: number
  s: number
} {
  const parts: Record<string, number> = {}
  for (const { type, value } of ZONE_FORMATTER.formatToParts(new Date(ms))) {
    if (type !== 'literal') parts[type] = Number(value)
  }
  return {
    y: parts.year,
    mo: parts.month,
    d: parts.day,
    h: parts.hour === 24 ? 0 : parts.hour,
    mi: parts.minute,
    s: parts.second,
  }
}

function zoneOffsetMs(ms: number): number {
  const p = zoneParts(ms)
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000
}

const pad = (value: number) => String(value).padStart(2, '0')

/** UTC instant -> `YYYY-MM-DDTHH:mm` wall clock in the exchange timezone. */
export function utcToExchangeInput(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const p = zoneParts(ms)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
}

const EXCHANGE_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** Exchange wall clock -> canonical UTC instant (`...Z`, no milliseconds), or null if invalid. */
export function exchangeInputToUtc(local: string): string | null {
  const match = EXCHANGE_INPUT.exec(local)
  if (!match) return null
  const [y, mo, d, h, mi] = match.slice(1).map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  const first = wall - zoneOffsetMs(wall)
  const resolved = wall - zoneOffsetMs(first)
  const date = new Date(resolved)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().replace('.000Z', 'Z')
}

/** `YYYY/MM/DD HH:mm` exchange label for a UTC instant. */
export function formatExchangeLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const input = utcToExchangeInput(iso)
  return input ? input.replace(/-/g, '/').replace('T', ' ') : '—'
}

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

export type SplitInput = {
  trainEndUtc: string | null
  validationEndUtc: string | null
  sourceStart: string | null | undefined
  sourceEnd: string | null | undefined
}

export type SplitErrors = { trainEnd?: string; validationEnd?: string }

export function validateSplit({
  trainEndUtc,
  validationEndUtc,
  sourceStart,
  sourceEnd,
}: SplitInput): SplitErrors {
  const errors: SplitErrors = {}
  const train = trainEndUtc ? Date.parse(trainEndUtc) : Number.NaN
  const validation = validationEndUtc ? Date.parse(validationEndUtc) : Number.NaN
  if (Number.isNaN(train)) errors.trainEnd = 'Enter a valid training end.'
  if (Number.isNaN(validation)) errors.validationEnd = 'Enter a valid validation end.'
  if (errors.trainEnd || errors.validationEnd) return errors
  const start = sourceStart ? Date.parse(sourceStart) : Number.NaN
  const end = sourceEnd ? Date.parse(sourceEnd) : Number.NaN
  if (!Number.isNaN(start) && train <= start) {
    errors.trainEnd = 'Training end must be after the first source bar.'
  }
  if (validation <= train) {
    errors.validationEnd = 'Validation end must be after training end.'
  }
  if (!Number.isNaN(end) && validation >= end && !errors.validationEnd) {
    errors.validationEnd = 'Validation end must leave a reserved tail before the last source bar.'
  }
  return errors
}

export type SplitRanges = {
  train: { start: string | null; end: string }
  validation: { start: string; end: string }
  reservedTail: { start: string; end: string | null }
}

export function buildSplitRanges(
  trainEndUtc: string,
  validationEndUtc: string,
  sourceStart: string | null | undefined,
  sourceEnd: string | null | undefined,
): SplitRanges {
  return {
    train: { start: sourceStart ?? null, end: trainEndUtc },
    validation: { start: trainEndUtc, end: validationEndUtc },
    reservedTail: { start: validationEndUtc, end: sourceEnd ?? null },
  }
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type TrainFormValues = {
  sourceRunId: string
  features: MlFilterFeatureName[]
  algorithms: MlFilterAlgorithm[]
  seed: number
  trainEndUtc: string
  validationEndUtc: string
  hyperparams: HyperparamDraft
}

export function buildTrainingRequest(values: TrainFormValues): MlFilterTrainingRequest {
  const algorithms = ML_FILTER_ALGORITHMS.map((item) => item.value).filter((value) =>
    values.algorithms.includes(value),
  )
  return {
    source_run_id: values.sourceRunId,
    selected_features: orderFeatures(values.features),
    algorithms,
    hyperparameters: buildHyperparameters(algorithms, values.hyperparams),
    seed: values.seed,
    train_end: values.trainEndUtc,
    validation_end: values.validationEndUtc,
  }
}

export function validateThreshold(threshold: number): string | null {
  if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
    return 'Threshold must be between 0 and 1.'
  }
  return null
}
