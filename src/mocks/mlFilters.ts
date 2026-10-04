import type {
  MlFilterAlgorithm,
  MlFilterComparisonRequest,
  MlFilterComparisonResultEntry,
  MlFilterComparisonStatusResponse,
  MlFilterError,
  MlFilterEvaluationRequest,
  MlFilterEvaluationStatusResponse,
  MlFilterFeatureName,
  MlFilterJobStage,
  MlFilterModelDetailResponse,
  MlFilterModelListResponse,
  MlFilterModelSummary,
  MlFilterSourceDetailResponse,
  MlFilterSourceListResponse,
  MlFilterSourceSummary,
  MlFilterTrainingRequest,
  MlFilterTrainingStatusResponse,
} from '../../contracts/api'
import type { MlFilterSourceDetail } from '@/api/queries/mlFilters'

/** Mirrors the Q-085 service rules for `BacktestRequest.ml_filter`; returns a 422 detail or null. */
export function validateMockMlFilterBacktest(request: {
  strategy?: string
  ml_filter?: { model_version_id: string; threshold?: number } | null
  entries?: unknown[] | null
  entry_manager?: { kind?: string } | null
  engine?: string
}): string | null {
  const isVariant = request.strategy === 'MACrossoverMLFilter'
  if (isVariant && !request.ml_filter) return 'ml_filter is required for MACrossoverMLFilter'
  if (!isVariant && request.ml_filter) {
    return 'ml_filter is only valid for MACrossoverMLFilter'
  }
  if (!isVariant) return null
  if (request.engine === 'tick') return 'MACrossoverMLFilter supports the candle engine only'
  if ((request.entries?.length ?? 1) !== 1 || (request.entry_manager?.kind ?? 'or') !== 'or') {
    return 'MACrossoverMLFilter supports exactly one entry with the or manager'
  }
  const modelId = request.ml_filter?.model_version_id
  if (!models.some((item) => item.summary.model_version_id === modelId && item.summary.ready)) {
    return `ML filter model version ${modelId} is not available`
  }
  return null
}

export function getMockMlFilterBacktestSummary(request: {
  ml_filter?: { model_version_id: string; threshold?: number } | null
}) {
  if (!request.ml_filter) return null
  const record = models.find(
    (item) => item.summary.model_version_id === request.ml_filter?.model_version_id,
  )
  return {
    model_version_id: request.ml_filter.model_version_id,
    dataset_id: record?.summary.dataset_id ?? null,
    threshold: request.ml_filter.threshold ?? 0.5,
    candidates_scored: 120,
    candidates_accepted: 54,
    candidates_rejected: 60,
    candidates_not_ready: 6,
  }
}

export type MlFilterMockError = { status: number; body: { detail: MlFilterError | string } }

export const MOCK_ML_SOURCE_OK_ID = 'run-win-ma'
export const MOCK_ML_SOURCE_NO_VOLUME_ID = 'run-vale-ma'
export const MOCK_ML_SOURCE_INELIGIBLE_ID = 'run-multi-entry'
export const MOCK_ML_SOURCE_FAIL_ID = 'run-win-ma-fail'
export const MOCK_ML_READY_MODEL_ID = 'mlf-model-lightgbm-seed'
export const MOCK_ML_INCOMPATIBLE_MODEL_ID = 'mlf-model-incompatible'
export const MOCK_ML_SEED_DATASET_ID = 'mlf-dataset-seed'
export const MOCK_ML_CONSUMED_DATASET_ID = 'mlf-dataset-consumed'

const ALL_FEATURES: MlFilterFeatureName[] = [
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
const NO_VOLUME_FEATURES = ALL_FEATURES.filter((feature) => feature !== 'real_volume')

const DEFAULT_SPLIT = {
  train_end: '2026-03-18T03:00:00Z',
  validation_end: '2026-04-09T03:00:00Z',
}

const SOURCES: MlFilterSourceDetail[] = [
  {
    run_id: MOCK_ML_SOURCE_OK_ID,
    strategy: 'MACrossover',
    symbol: 'WIN$',
    timeframe: 'M5',
    eligible: true,
    eligibility_reason: null,
    source_sample_count: 412,
    date_range_start: '2026-01-02T03:00:00Z',
    date_range_end: '2026-05-04T03:00:00Z',
    available_features: ALL_FEATURES,
    split_suggestion: DEFAULT_SPLIT,
    volume_readiness: null,
  },
  {
    run_id: MOCK_ML_SOURCE_NO_VOLUME_ID,
    strategy: 'MACrossover',
    symbol: 'VALE3',
    timeframe: 'H1',
    eligible: true,
    eligibility_reason: null,
    source_sample_count: 188,
    date_range_start: '2026-01-02T03:00:00Z',
    date_range_end: '2026-05-04T03:00:00Z',
    available_features: NO_VOLUME_FEATURES,
    split_suggestion: DEFAULT_SPLIT,
    volume_readiness: 'real_volume is unavailable for this symbol; tick_volume remains available.',
  },
  {
    run_id: MOCK_ML_SOURCE_INELIGIBLE_ID,
    strategy: 'MACrossover',
    symbol: 'WIN$',
    timeframe: 'M15',
    eligible: false,
    eligibility_reason: 'Source run uses multiple entries; only single-entry runs can be used.',
    eligibility_errors: ['Source run uses multiple entries; only single-entry runs can be used.'],
    source_sample_count: 0,
    date_range_start: '2026-01-02T03:00:00Z',
    date_range_end: '2026-05-04T03:00:00Z',
    available_features: [],
    split_suggestion: null,
    volume_readiness: null,
  },
  {
    run_id: MOCK_ML_SOURCE_FAIL_ID,
    strategy: 'MACrossover',
    symbol: 'WDO$',
    timeframe: 'M5',
    eligible: true,
    eligibility_reason: null,
    source_sample_count: 61,
    date_range_start: '2026-01-02T03:00:00Z',
    date_range_end: '2026-05-04T03:00:00Z',
    available_features: ALL_FEATURES,
    split_suggestion: DEFAULT_SPLIT,
    volume_readiness: null,
  },
]

type ModelRecord = {
  summary: MlFilterModelSummary
  sourceRunId: string
  seed: number
  hyperparameters: Record<string, unknown>
}

const SEED_MODELS: ModelRecord[] = [
  {
    summary: {
      model_version_id: MOCK_ML_READY_MODEL_ID,
      dataset_id: MOCK_ML_SEED_DATASET_ID,
      algorithm: 'lightgbm',
      ready: true,
      selected_features: ['close', 'ma_short', 'ma_long', 'side'],
      symbol: 'WIN$',
      timeframe: 'M5',
      train_end: DEFAULT_SPLIT.train_end,
      compatibility_reasons: [],
    },
    sourceRunId: MOCK_ML_SOURCE_OK_ID,
    seed: 42,
    hyperparameters: { n_estimators: 200, learning_rate: 0.05, num_leaves: 31 },
  },
  {
    summary: {
      model_version_id: MOCK_ML_INCOMPATIBLE_MODEL_ID,
      dataset_id: MOCK_ML_CONSUMED_DATASET_ID,
      algorithm: 'random_forest',
      ready: false,
      selected_features: ['close', 'real_volume', 'side'],
      symbol: 'WIN$',
      timeframe: 'M5',
      train_end: DEFAULT_SPLIT.train_end,
      compatibility_reasons: ['Model artifact checksum does not match its manifest.'],
    },
    sourceRunId: MOCK_ML_SOURCE_OK_ID,
    seed: 7,
    hyperparameters: { n_estimators: 300, min_samples_leaf: 5 },
  },
]

type TrainingJob = {
  request: MlFilterTrainingRequest
  polls: number
  datasetId: string
  modelIds: string[]
}

type ComparisonJob = { request: MlFilterComparisonRequest; polls: number }
type EvaluationJob = { request: Required<MlFilterEvaluationRequest>; polls: number }

let models: ModelRecord[] = []
let trainingJobs = new Map<string, TrainingJob>()
let comparisonJobs = new Map<string, ComparisonJob>()
let evaluationJobs = new Map<string, EvaluationJob>()
let lockboxes = new Map<string, { jobId: string; modelId: string; threshold: number }>()
let sequence = 0

export function resetMockMlFilterState(): void {
  models = SEED_MODELS.map((record) => ({ ...record, summary: { ...record.summary } }))
  trainingJobs = new Map()
  comparisonJobs = new Map()
  evaluationJobs = new Map()
  lockboxes = new Map([
    [
      MOCK_ML_CONSUMED_DATASET_ID,
      { jobId: 'mlf-eval-previous', modelId: 'mlf-model-other', threshold: 0.6 },
    ],
  ])
  sequence = 0
}
resetMockMlFilterState()

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

export function getMockMlTrainingRequest(
  overrides: Partial<MlFilterTrainingRequest> = {},
): MlFilterTrainingRequest {
  return {
    source_run_id: MOCK_ML_SOURCE_OK_ID,
    selected_features: ['close', 'ma_short', 'ma_long', 'side'],
    algorithms: ['lightgbm', 'logistic_regression'],
    seed: 42,
    ...DEFAULT_SPLIT,
    ...overrides,
  }
}

function mockError(
  status: number,
  code: MlFilterError['code'],
  message: string,
): MlFilterMockError {
  return { status, body: { detail: { code, message } } }
}

export function listMockMlSources(limit = 50, offset = 0): MlFilterSourceListResponse {
  const items = SOURCES.map(toSummary)
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset }
}

function toSummary(source: MlFilterSourceDetail): MlFilterSourceSummary {
  const {
    eligibility_errors: _errors,
    split_suggestion: _split,
    volume_readiness: _volume,
    ...summary
  } = source
  void _errors
  void _split
  void _volume
  return summary
}

export function getMockMlSource(runId: string): MlFilterSourceDetailResponse | null {
  return SOURCES.find((source) => source.run_id === runId) ?? null
}

export function startMockMlTraining(
  request: MlFilterTrainingRequest,
): { jobId: string } | MlFilterMockError {
  const source = SOURCES.find((item) => item.run_id === request.source_run_id)
  if (!source) {
    return { status: 404, body: { detail: 'Backtest source was not found' } }
  }
  if (!source.eligible) {
    return mockError(
      422,
      'incompatible_source',
      source.eligibility_reason ?? 'Source is ineligible',
    )
  }
  if (Date.parse(request.train_end) >= Date.parse(request.validation_end)) {
    return mockError(422, 'invalid_split', 'train_end must be strictly before validation_end')
  }
  const jobId = nextId('mlf-train')
  const datasetId = `mlf-dataset-${jobId}`
  trainingJobs.set(jobId, { request, polls: 0, datasetId, modelIds: [] })
  return { jobId }
}

const TRAINING_STAGES: Array<{ stage: MlFilterJobStage; current: number }> = [
  { stage: 'dataset', current: 0 },
  { stage: 'dataset', current: 1 },
  { stage: 'fitting', current: 1 },
  { stage: 'validation', current: 2 },
  { stage: 'persisting', current: 3 },
]

export function getMockMlTrainingStatus(jobId: string): MlFilterTrainingStatusResponse | null {
  const job = trainingJobs.get(jobId)
  if (!job) return null
  job.polls += 1
  const index = job.polls - 1
  if (index === 0) {
    return { job_id: jobId, status: 'queued', stage: null, progress: null }
  }
  const stageIndex = index - 1
  if (stageIndex < TRAINING_STAGES.length) {
    const stage = TRAINING_STAGES[stageIndex]
    if (job.request.source_run_id === MOCK_ML_SOURCE_FAIL_ID && stage.stage === 'fitting') {
      return {
        job_id: jobId,
        status: 'failed',
        stage: 'fitting',
        progress: { current: 12, total: 61 },
        rejections: { not_ready_features: 9, label_unavailable: 4 },
        error: {
          code: 'training_failed',
          message: 'Training failed: only 61 samples remained after rejections.',
          details: { samples_used: 61 },
        },
      }
    }
    return {
      job_id: jobId,
      status: 'running',
      stage: stage.stage,
      progress: { current: stage.current, total: 3 },
      rejections: { not_ready_features: 9, label_unavailable: 4 },
    }
  }
  if (job.modelIds.length === 0) {
    job.modelIds = job.request.algorithms.map((algorithm) => persistMockModel(job, algorithm))
  }
  return {
    job_id: jobId,
    status: 'completed',
    stage: 'persisting',
    progress: { current: 3, total: 3 },
    dataset_id: job.datasetId,
    comparison_id: `${job.datasetId}-cmp`,
    model_version_ids: job.modelIds,
    rejections: { not_ready_features: 9, label_unavailable: 4 },
  }
}

function persistMockModel(job: TrainingJob, algorithm: MlFilterAlgorithm): string {
  const id = `${job.datasetId}-${algorithm}`
  const source = SOURCES.find((item) => item.run_id === job.request.source_run_id)
  models.push({
    summary: {
      model_version_id: id,
      dataset_id: job.datasetId,
      algorithm,
      ready: true,
      selected_features: job.request.selected_features,
      symbol: source?.symbol,
      timeframe: source?.timeframe,
      train_end: job.request.train_end,
      compatibility_reasons: [],
    },
    sourceRunId: job.request.source_run_id,
    seed: job.request.seed ?? 42,
    hyperparameters: { ...(job.request.hyperparameters?.[algorithm] ?? {}) },
  })
  return id
}

export function listMockMlModels(
  params: { dataset_id?: string | null; symbol?: string | null; timeframe?: string | null } = {},
  limit = 50,
  offset = 0,
): MlFilterModelListResponse {
  const items = models
    .map((record) => record.summary)
    .filter(
      (item) =>
        (!params.dataset_id || item.dataset_id === params.dataset_id) &&
        (!params.symbol || item.symbol === params.symbol) &&
        (!params.timeframe || item.timeframe === params.timeframe),
    )
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset }
}

export function getMockMlModel(
  modelVersionId: string,
): MlFilterModelDetailResponse | MlFilterMockError | null {
  const record = models.find((item) => item.summary.model_version_id === modelVersionId)
  if (!record) return null
  if (!record.summary.ready) {
    return mockError(
      409,
      'artifact_unavailable',
      (record.summary.compatibility_reasons ?? []).join(' ') || 'Model artifact is unavailable.',
    )
  }
  return {
    model_version_id: record.summary.model_version_id,
    dataset_id: record.summary.dataset_id,
    algorithm: record.summary.algorithm,
    selected_features: record.summary.selected_features,
    manifest_identity: { format_version: 1, model_content_id: `sha256:${modelVersionId}` },
    pipeline_versions: { scikit_learn: '1.5', lightgbm: '4.5' },
    provenance: {
      source_run_id: record.sourceRunId,
      hyperparameters: record.hyperparameters,
      seed: record.seed,
    },
    validation_metrics: {
      roc_auc: { value: 0.61 },
      confusion_matrix: [
        [58, 21],
        [33, 40],
      ],
    },
  }
}

export function startMockMlComparison(
  request: MlFilterComparisonRequest,
): { jobId: string } | MlFilterMockError {
  const members = request.model_version_ids.map((id) =>
    models.find((item) => item.summary.model_version_id === id),
  )
  if (
    request.model_version_ids.length === 0 ||
    members.some((member) => !member || member.summary.dataset_id !== request.dataset_id)
  ) {
    return mockError(409, 'incompatible_model', 'Compared models must share one dataset and split.')
  }
  const jobId = nextId('mlf-cmp')
  comparisonJobs.set(jobId, { request, polls: 0 })
  return { jobId }
}

function comparisonEntry(
  request: MlFilterComparisonRequest,
  modelId: string,
  index: number,
): MlFilterComparisonResultEntry {
  const threshold = request.threshold ?? 0.5
  const singleClass = index === 1
  const accepted = Math.max(0, Math.round(80 - threshold * 60 - index * 6))
  return {
    model_version_id: modelId,
    dataset_id: request.dataset_id,
    threshold,
    baseline: {
      net_pnl: 1840.5,
      max_drawdown: -920.25,
      profit_factor: { value: 1.18 },
      trade_count: 96,
    },
    filtered: {
      net_pnl: 2310.75 - index * 410,
      max_drawdown: -610.5,
      profit_factor: singleClass
        ? {
            value: null,
            unavailable_reason: 'No losing trades after filtering; profit factor is undefined.',
          }
        : { value: 1.42 - index * 0.1 },
      trade_count: accepted,
    },
    classification: {
      roc_auc: singleClass
        ? { value: null, unavailable_reason: 'Validation labels contain a single class.' }
        : { value: 0.63 - index * 0.02 },
      confusion_matrix: singleClass
        ? null
        : [
            [52, 18],
            [31, 29],
          ],
    },
    acceptance_counts: {
      scored: 120,
      accepted,
      rejected: 120 - accepted - 6,
      not_ready: 6,
    },
    equity_artifact_ref: null,
    trades_artifact_ref: null,
  }
}

export function getMockMlComparisonStatus(jobId: string): MlFilterComparisonStatusResponse | null {
  const job = comparisonJobs.get(jobId)
  if (!job) return null
  job.polls += 1
  if (job.polls === 1) return { job_id: jobId, status: 'queued' }
  if (job.polls === 2) return { job_id: jobId, status: 'running' }
  return {
    job_id: jobId,
    status: 'completed',
    results: job.request.model_version_ids.map((id, index) =>
      comparisonEntry(job.request, id, index),
    ),
  }
}

export function startMockMlEvaluation(
  request: MlFilterEvaluationRequest,
): { jobId: string } | MlFilterMockError {
  const threshold = request.threshold ?? 0.5
  const lock = lockboxes.get(request.dataset_id)
  if (lock) {
    if (lock.modelId === request.model_version_id && lock.threshold === threshold) {
      return { jobId: lock.jobId }
    }
    return mockError(
      409,
      'lockbox_consumed',
      'The reserved tail for this dataset was already consumed by a different model version or threshold.',
    )
  }
  if (!models.some((item) => item.summary.model_version_id === request.model_version_id)) {
    return { status: 404, body: { detail: 'ML filter model version was not found' } }
  }
  const jobId = nextId('mlf-eval')
  lockboxes.set(request.dataset_id, { jobId, modelId: request.model_version_id, threshold })
  evaluationJobs.set(jobId, {
    request: {
      dataset_id: request.dataset_id,
      model_version_id: request.model_version_id,
      threshold,
    },
    polls: 0,
  })
  return { jobId }
}

export function getMockMlEvaluationStatus(jobId: string): MlFilterEvaluationStatusResponse | null {
  const job = evaluationJobs.get(jobId)
  if (!job) return null
  job.polls += 1
  const common = {
    job_id: jobId,
    dataset_id: job.request.dataset_id,
    model_version_id: job.request.model_version_id,
    threshold: job.request.threshold,
  }
  if (job.polls === 1) return { ...common, status: 'queued' }
  if (job.polls === 2) return { ...common, status: 'running' }
  return {
    ...common,
    status: 'completed',
    result: {
      baseline: {
        net_pnl: 640.0,
        max_drawdown: -410.0,
        profit_factor: { value: 1.09 },
        trade_count: 31,
      },
      filtered: {
        net_pnl: 520.25,
        max_drawdown: -280.5,
        profit_factor: { value: 1.21 },
        trade_count: 17,
      },
    },
  }
}
