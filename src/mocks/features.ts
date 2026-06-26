import type {
  FeatureEvalRun,
  FeatureLeaderboardItem,
  FeatureListItem,
  FeaturePassport,
  FeatureScoreRow,
  FeatureStatus,
} from '@/types/features'

export const MOCK_COMPLETED_EVAL_RUN_ID = 'eval_mock_completed'
export const MOCK_RUNNING_EVAL_RUN_ID = 'eval_mock_running'

export const mockRecentEvalRuns = [
  { run_id: MOCK_COMPLETED_EVAL_RUN_ID, label: 'EURUSD H1 · completed' },
  { run_id: MOCK_RUNNING_EVAL_RUN_ID, label: 'EURUSD H1 · running' },
]

const registryProvenance = { source_wo: 'WO127', author: 'registry' }

function versionDetail(
  version: number,
  status: FeatureStatus,
  nodeKind: string,
  paramKeys: string[],
  defaultParams: Record<string, unknown>,
  leakageStatus = 'clean',
) {
  return {
    version,
    status,
    node_kind: nodeKind,
    param_keys: paramKeys,
    default_params: defaultParams,
    forward_window: 0,
    leakage_status: leakageStatus,
    provenance: registryProvenance,
  }
}

export const mockFeatureList: FeatureListItem[] = [
  {
    name: 'rsi',
    category: 'momentum',
    latest_version: 1,
    status: 'production',
    usage_count: 12,
    score: 0.74,
  },
  {
    name: 'macd',
    category: 'momentum',
    latest_version: 1,
    status: 'candidate',
    usage_count: 8,
    score: 0.61,
  },
  {
    name: 'atr',
    category: 'volatility',
    latest_version: 1,
    status: 'experimental',
    usage_count: 3,
    score: 0.42,
  },
  {
    name: 'ma',
    category: 'trend',
    latest_version: 1,
    status: 'production',
    usage_count: 15,
    score: 0.68,
  },
  {
    name: 'realized_vol',
    category: 'volatility',
    latest_version: 1,
    status: 'candidate',
    usage_count: 5,
    score: 0.55,
  },
  {
    name: 'donchian_upper',
    category: 'trend',
    latest_version: 1,
    status: 'experimental',
    usage_count: 1,
    score: null,
  },
]

export const mockFeaturePassports: Record<string, FeaturePassport> = {
  rsi: {
    name: 'rsi',
    category: 'momentum',
    description: 'Relative Strength Index on a price source.',
    usage_count: 12,
    score: 0.74,
    versions: [versionDetail(1, 'production', 'ind.rsi', ['period'], { period: 14 })],
    evaluation_history: [
      {
        run_id: 'eval_mock_rsi_1',
        target: 'forward_return(5)',
        rank_ic: 0.18,
        global_score: 0.74,
        evaluated_at: '2026-06-20T14:30:00.000Z',
        symbol: 'EURUSD',
        timeframe: 'H1',
      },
    ],
  },
  leaky_signal: {
    name: 'leaky_signal',
    category: 'momentum',
    description: 'Fixture feature with suspect leakage status for passport tests.',
    usage_count: 2,
    score: 0.31,
    versions: [
      versionDetail(1, 'experimental', 'ind.leaky', ['period'], { period: 10 }, 'suspect'),
    ],
    evaluation_history: [],
  },
  macd: {
    name: 'macd',
    category: 'momentum',
    description: 'MACD line (fast EMA minus slow EMA).',
    usage_count: 8,
    score: 0.61,
    versions: [
      versionDetail(1, 'candidate', 'ind.macd', ['fast_period', 'slow_period', 'signal_period'], {
        fast_period: 12,
        slow_period: 26,
        signal_period: 9,
      }),
    ],
    evaluation_history: [],
  },
  atr: {
    name: 'atr',
    category: 'volatility',
    description: 'Average True Range (Wilder) on OHLC bars.',
    usage_count: 3,
    score: 0.42,
    versions: [versionDetail(1, 'experimental', 'ind.atr', ['period'], { period: 14 })],
    evaluation_history: [],
  },
  ma: {
    name: 'ma',
    category: 'trend',
    description: 'Moving average of a price source.',
    usage_count: 15,
    score: 0.68,
    versions: [
      versionDetail(1, 'production', 'ind.ma', ['period', 'ma_type', 'source'], {
        period: 20,
        ma_type: 'sma',
        source: 'close',
      }),
    ],
    evaluation_history: [],
  },
  realized_vol: {
    name: 'realized_vol',
    category: 'volatility',
    description: 'Realized volatility (close-to-close or Yang–Zhang).',
    usage_count: 5,
    score: 0.55,
    versions: [
      versionDetail(1, 'candidate', 'ind.realized_vol', ['window', 'estimator'], {
        window: 63,
        estimator: 'close_to_close',
      }),
    ],
    evaluation_history: [],
  },
  donchian_upper: {
    name: 'donchian_upper',
    category: 'trend',
    description: 'Donchian channel upper bound (rolling high).',
    usage_count: 1,
    score: null,
    versions: [versionDetail(1, 'experimental', 'ind.donchian', ['period'], { period: 20 })],
    evaluation_history: [],
  },
}

export const mockRecommendedFeatureNames = ['rsi', 'ma', 'leaky_signal']

export const mockFeatureLeaderboard: FeatureLeaderboardItem[] = [
  { feature_name: 'rsi', global_score: 0.74 },
  { feature_name: 'ma', global_score: 0.68 },
  { feature_name: 'macd', global_score: 0.61 },
  { feature_name: 'realized_vol', global_score: 0.55 },
  { feature_name: 'atr', global_score: 0.42 },
  { feature_name: 'leaky_signal', global_score: 0.31 },
]

const mockEvalLeaderboard: FeatureScoreRow[] = [
  {
    feature_id: 'rsi.v1.a1b2c3d4',
    feature_name: 'rsi',
    ic: 0.16,
    rank_ic: 0.18,
    mutual_info: 0.12,
    stability: 0.81,
    global_score: 0.74,
    cluster_id: 1,
    is_representative: true,
    leakage_status: 'clean',
    regime_ics: { low_vol: 0.14, high_vol: 0.11 },
    window_rank_ics: [0.19, 0.18, 0.17, 0.18, 0.17, 0.16],
  },
  {
    feature_id: 'ma.v1.e5f6g7h8',
    feature_name: 'ma',
    ic: 0.13,
    rank_ic: 0.15,
    mutual_info: 0.1,
    stability: 0.77,
    global_score: 0.68,
    cluster_id: 2,
    is_representative: true,
    leakage_status: 'clean',
    regime_ics: { low_vol: 0.12, high_vol: 0.09 },
    window_rank_ics: [0.16, 0.15, 0.14, 0.15, 0.14, 0.13],
  },
  {
    feature_id: 'macd.v1.i9j0k1l2',
    feature_name: 'macd',
    ic: 0.1,
    rank_ic: 0.11,
    mutual_info: 0.08,
    stability: 0.7,
    global_score: 0.61,
    cluster_id: 1,
    is_representative: false,
    leakage_status: 'clean',
    regime_ics: { low_vol: 0.09, high_vol: 0.07 },
    window_rank_ics: [0.18, 0.14, 0.1, 0.06, 0.02, -0.03],
  },
  {
    feature_id: 'leaky.v1.suspect01',
    feature_name: 'leaky_signal',
    ic: 0.21,
    rank_ic: 0.2,
    mutual_info: 0.09,
    stability: 0.42,
    global_score: 0.31,
    cluster_id: 3,
    is_representative: true,
    leakage_status: 'suspect',
    regime_ics: { low_vol: 0.2, high_vol: 0.03 },
    window_rank_ics: [0.2, 0.12, 0.05, -0.01, -0.04, -0.08],
  },
]

type MockEvalJob = {
  run_id: string
  status: FeatureEvalRun['status']
  start_time: number
  request: {
    symbol: string
    timeframe: string
    target: { name: string; horizon: number }
    features: Array<{ name: string }>
  }
}

const mockEvalJobs = new Map<string, MockEvalJob>()

function seedDefaultEvalJobs() {
  if (!mockEvalJobs.has(MOCK_COMPLETED_EVAL_RUN_ID)) {
    mockEvalJobs.set(MOCK_COMPLETED_EVAL_RUN_ID, {
      run_id: MOCK_COMPLETED_EVAL_RUN_ID,
      status: 'completed',
      start_time: Date.now() - 10_000,
      request: {
        symbol: 'EURUSD',
        timeframe: 'H1',
        target: { name: 'fwd_return', horizon: 5 },
        features: [{ name: 'rsi' }, { name: 'ma' }, { name: 'macd' }, { name: 'leaky_signal' }],
      },
    })
  }

  if (!mockEvalJobs.has(MOCK_RUNNING_EVAL_RUN_ID)) {
    mockEvalJobs.set(MOCK_RUNNING_EVAL_RUN_ID, {
      run_id: MOCK_RUNNING_EVAL_RUN_ID,
      status: 'running',
      start_time: Date.now() - 1_500,
      request: {
        symbol: 'EURUSD',
        timeframe: 'H1',
        target: { name: 'fwd_return', horizon: 5 },
        features: [{ name: 'rsi' }, { name: 'ma' }, { name: 'macd' }, { name: 'leaky_signal' }],
      },
    })
  }
}

function buildHeatmap(rows: FeatureScoreRow[]) {
  return {
    metrics: ['ic', 'rank_ic', 'mutual_info', 'stability'],
    rows: rows.map((row) => ({
      feature_id: row.feature_id,
      feature_name: row.feature_name,
      ic: row.ic,
      rank_ic: row.rank_ic,
      mutual_info: row.mutual_info,
      stability: row.stability,
    })),
  }
}

function buildClusters(rows: FeatureScoreRow[]) {
  const byCluster = new Map<number, FeatureScoreRow[]>()
  for (const row of rows) {
    const clusterId = row.cluster_id ?? 0
    byCluster.set(clusterId, [...(byCluster.get(clusterId) ?? []), row])
  }

  return [...byCluster.entries()]
    .sort(([left], [right]) => left - right)
    .map(([clusterId, members]) => ({
      cluster_id: clusterId,
      feature_ids: members.map((row) => row.feature_id),
      representative:
        members.find((row) => row.is_representative)?.feature_id ?? members[0]!.feature_id,
    }))
}

export function resetMockFeatureState() {
  mockEvalJobs.clear()
  seedDefaultEvalJobs()
  for (const item of mockFeatureList) {
    const passport = mockFeaturePassports[item.name]
    if (passport?.versions[0]) {
      passport.versions[0].status = item.status
    }
  }
}

seedDefaultEvalJobs()

export function getMockFeatureList(params?: { category?: string; status?: string }) {
  return mockFeatureList.filter((item) => {
    if (params?.category && item.category !== params.category) return false
    if (params?.status && item.status !== params.status) return false
    return true
  })
}

export function getUpdatedMockEvalJob(runId: string): MockEvalJob | undefined {
  const job = mockEvalJobs.get(runId)
  if (!job) return undefined
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return job
  }

  const elapsed = Date.now() - job.start_time
  if (elapsed < 800) {
    job.status = 'pending'
  } else if (elapsed < 3200) {
    job.status = 'running'
  } else {
    job.status = 'completed'
  }
  return job
}

export function featureEvalRunFromJob(job: MockEvalJob): FeatureEvalRun {
  const featureNames = job.request.features.map((feature) => feature.name)
  const fullLeaderboard = mockEvalLeaderboard.filter((row) =>
    featureNames.includes(row.feature_name),
  )
  const leaderboard =
    job.status === 'running' || job.status === 'pending'
      ? fullLeaderboard.slice(0, 1)
      : fullLeaderboard
  const clusters =
    job.status === 'running' || job.status === 'pending' ? [] : buildClusters(fullLeaderboard)
  const recommended = fullLeaderboard
    .filter((row) => row.is_representative)
    .map((row) => row.feature_id)
  const topScore = Math.max(...fullLeaderboard.map((row) => row.global_score ?? 0))
  const isActive = job.status === 'running' || job.status === 'pending'

  const result_summary = isActive
    ? {
        stage: 'evaluating' as const,
        processed_features: Math.min(1, featureNames.length),
        total_features: featureNames.length,
      }
    : {
        recommended_feature_ids: recommended,
        cluster_count: clusters.length,
        top_global_score: topScore,
        matrix_id: 'matrix_mock_59df0155',
      }

  return {
    run_id: job.run_id,
    status: job.status,
    symbol: job.request.symbol,
    timeframe: job.request.timeframe,
    target_name: job.request.target.name,
    target_horizon: job.request.target.horizon,
    feature_count: featureNames.length,
    matrix_id: 'matrix_mock_59df0155',
    result_summary,
    started_at: new Date(job.start_time).toISOString(),
    leaderboard,
    clusters,
    heatmap: buildHeatmap(leaderboard),
    error_message: null,
  }
}

export function createMockEvalJob(body: {
  symbol: string
  timeframe: string
  start: string
  end: string
  target: { name: string; horizon: number }
  features: Array<{ name: string }>
}): MockEvalJob {
  const runId = `eval_${Math.random().toString(36).slice(2, 10)}`
  const job: MockEvalJob = {
    run_id: runId,
    status: 'pending',
    start_time: Date.now(),
    request: body,
  }
  mockEvalJobs.set(runId, job)
  return job
}

export function setMockFeatureStatus(name: string, version: number, status: FeatureStatus) {
  const listItem = mockFeatureList.find((item) => item.name === name)
  if (listItem) listItem.status = status

  const passport = mockFeaturePassports[name]
  if (!passport) return null
  const versionRow = passport.versions.find((row) => row.version === version)
  if (!versionRow) return null
  versionRow.status = status
  return passport
}
