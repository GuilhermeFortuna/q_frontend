import { http, HttpResponse } from 'msw'

import { getMockBacktestResponse } from '@/mocks/backtest'
import { getMockBacktestEquityArtifact } from '@/mocks/backtestEquity'
import {
  getMockBacktestRunDetail,
  getMockOptimizationResults,
  getMockOptimizationStatus,
  getMockOhlcv,
  getMockTicks,
  mockBacktestRunSummaries,
  mockInstrumentInfo,
  mockInstruments,
  mockOptimizationStudySummaries,
  mockSnapshots,
  mockStrategies,
  mockSystemHealth,
} from '@/mocks/data'
import {
  deletedWalkForwardRunIds,
  getMockWalkForwardResults,
  getMockWalkForwardStatus,
  getUpdatedWalkForwardJob,
  mockWalkForwardJobs,
  mockWalkForwardRunSummaries,
  resetMockWalkForwardState,
  walkForwardResultsFromJob,
  walkForwardStatusFromJob,
} from '@/mocks/walkforward'
import {
  createMockIngestJob,
  getMockIngestJob,
  getUpdatedMockIngestJob,
  ingestStatusPayload,
  mockDataSource,
  mockStorageInventory,
  resetMockStorageState,
} from '@/mocks/storage'
import {
  deletedStrategySearchRunIds,
  getMockCandidateEquityPoints,
  getMockCandidateGenome,
  getMockStrategySearchResults,
  getMockStrategySearchStatus,
  getUpdatedStrategySearchJob,
  mockStrategySearchJobs,
  mockStrategySearchRunSummaries,
  resetMockStrategySearchState,
  strategySearchResultsFromJob,
  strategySearchStatusFromJob,
} from '@/mocks/strategySearch'
import type { BacktestRequest } from '@/types/backtesting'
import type { OptimizationTrial } from '@/types/optimization'

const deletedBacktestRunIds = new Set<string>()
const deletedOptimizationStudyIds = new Set<string>()
const savedBacktestRunOverrides = new Map<string, boolean>()
const mockBacktestJobs = new Map<string, ReturnType<typeof getMockBacktestResponse>>()
let mockBacktestJobSeq = 1

export function resetMockBacktestDeletes() {
  deletedBacktestRunIds.clear()
  savedBacktestRunOverrides.clear()
}

export function resetMockOptimizationDeletes() {
  deletedOptimizationStudyIds.clear()
}

export function resetMockWalkForwardDeletes() {
  resetMockWalkForwardState()
}

export function resetMockStrategySearchDeletes() {
  resetMockStrategySearchState()
}

export function resetMockStorageDeletes() {
  resetMockStorageState()
}

export const handlers = [
  http.get('*/api/v1/system/health', () => HttpResponse.json(mockSystemHealth)),

  http.get('*/api/v1/system/data-source', () => HttpResponse.json(mockDataSource)),

  http.put('*/api/v1/system/data-source', async ({ request }) => {
    const body = (await request.json()) as { source?: string }
    if (body.source === 'auto' || body.source === 'mt5' || body.source === 'local') {
      Object.assign(mockDataSource, {
        source: body.source,
        active_provider:
          body.source === 'local'
            ? 'local'
            : body.source === 'mt5' && mockDataSource.mt5_available
              ? 'mt5'
              : mockDataSource.mt5_available
                ? 'mt5'
                : 'local',
      })
    }
    return HttpResponse.json(mockDataSource)
  }),

  http.get('*/api/v1/storage/inventory', () =>
    HttpResponse.json({
      root: mockSystemHealth.market_data_root ?? '/mock/data/market',
      items: mockStorageInventory,
    }),
  ),

  http.post('*/api/v1/storage/ingest', async ({ request }) => {
    if (!mockDataSource.mt5_available) {
      return HttpResponse.json(
        { detail: 'Ingestion requires MetaTrader 5 as the source.' },
        { status: 503 },
      )
    }
    const body = (await request.json()) as {
      symbol: string
      timeframes: string[]
      start: string
      end: string
      kind?: 'bars' | 'ticks'
    }
    const job = createMockIngestJob(body)
    return HttpResponse.json({ job_id: job.job_id, status: 'queued' })
  }),

  http.get('*/api/v1/storage/ingest/:jobId', ({ params }) => {
    const jobId = String(params.jobId)
    const existing = getMockIngestJob(jobId)
    if (!existing) {
      return HttpResponse.json(
        { detail: `Storage ingest job '${jobId}' not found.` },
        { status: 404 },
      )
    }
    const job = getUpdatedMockIngestJob(jobId)
    if (!job) {
      return HttpResponse.json(
        { detail: `Storage ingest job '${jobId}' not found.` },
        { status: 404 },
      )
    }
    return HttpResponse.json(ingestStatusPayload(job))
  }),

  http.delete('*/api/v1/storage/:symbol/:timeframe', ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    const segment = String(params.timeframe).toUpperCase()
    const kept =
      segment === 'TICKS'
        ? mockStorageInventory.filter(
            (item) => !(item.symbol === symbol && (item.kind ?? 'bars') === 'ticks'),
          )
        : mockStorageInventory.filter(
            (item) =>
              !(
                item.symbol === symbol &&
                (item.kind ?? 'bars') === 'bars' &&
                item.timeframe === segment
              ),
          )
    mockStorageInventory.splice(0, mockStorageInventory.length, ...kept)
    mockSystemHealth.market_data_inventory_count = mockStorageInventory.length
    return HttpResponse.json({
      deleted: true,
      symbol,
      timeframe: segment === 'TICKS' ? 'ticks' : segment,
    })
  }),

  http.get('*/api/v1/strategies', () => HttpResponse.json(mockStrategies)),

  http.get('*/api/v1/market/instruments', () => HttpResponse.json(mockInstruments)),

  http.get('*/api/v1/market/symbols/search', ({ request }) => {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') || '').toUpperCase()
    if (!q) return HttpResponse.json([])

    const pool = [
      ...mockInstruments,
      { symbol: 'PETR3', name: 'PETROBRAS ON N2', exchange: 'BOVESPA', assetClass: 'equity' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'ARCA', assetClass: 'etf' },
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', assetClass: 'equity' },
    ]
    const matches = pool.filter(
      (inst) => inst.symbol.toUpperCase().includes(q) || inst.name.toUpperCase().includes(q),
    )
    return HttpResponse.json(matches)
  }),

  http.get('*/api/v1/market/snapshots', ({ request }) => {
    const url = new URL(request.url)
    const symbols = (url.searchParams.get('symbols') || '')
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)

    const snapshots = symbols
      .map((symbol) => mockSnapshots[symbol])
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot != null)

    return HttpResponse.json({ snapshots })
  }),

  http.get('*/api/v1/market/snapshot/:symbol', ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    const snapshot = mockSnapshots[symbol]
    if (!snapshot) {
      return HttpResponse.json({ detail: `Symbol '${symbol}' not found.` }, { status: 404 })
    }
    return HttpResponse.json(snapshot)
  }),

  http.get('*/api/v1/market/ticks/:symbol', ({ params, request }) => {
    const symbol = String(params.symbol).toUpperCase()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '200', 10)
    return HttpResponse.json(getMockTicks(symbol, limit))
  }),

  http.get('*/api/v1/market/instrument-info/:symbol', ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    const info = mockInstrumentInfo[symbol]
    if (!info) {
      return HttpResponse.json(
        { detail: `Instrument info for '${symbol}' not found.` },
        { status: 404 },
      )
    }
    return HttpResponse.json(info)
  }),

  http.get('*/api/v1/market/ohlcv/:symbol/available-range', ({ params, request }) => {
    const symbol = String(params.symbol).toUpperCase()
    const url = new URL(request.url)
    const timeframe = url.searchParams.get('timeframe') ?? 'D1'
    const end = new Date()
    const start = new Date(end)
    start.setFullYear(start.getFullYear() - 5)
    return HttpResponse.json({
      symbol,
      timeframe,
      start: start.toISOString(),
      end: end.toISOString(),
      bar_count: 1200,
    })
  }),

  http.get('*/api/v1/market/ohlcv/:symbol', ({ params, request }) => {
    const symbol = String(params.symbol).toUpperCase()
    const url = new URL(request.url)
    const timeframe = url.searchParams.get('timeframe') ?? 'D1'
    const count = parseInt(url.searchParams.get('count') ?? '500', 10)
    const start = url.searchParams.get('start') ?? undefined
    const end = url.searchParams.get('end') ?? undefined
    return HttpResponse.json(
      getMockOhlcv(symbol, timeframe, count, {
        start,
        end,
      }),
    )
  }),

  http.post('*/api/v1/backtest/run', async ({ request }) => {
    const body = (await request.json()) as BacktestRequest
    return HttpResponse.json(getMockBacktestResponse(body))
  }),

  // Async backtest job endpoints. The mock resolves immediately to "completed" so
  // polling tests settle on the first status fetch.
  http.post('*/api/v1/backtest', async ({ request }) => {
    const body = (await request.json()) as BacktestRequest
    const runId = `mock-backtest-${mockBacktestJobSeq++}`
    mockBacktestJobs.set(runId, getMockBacktestResponse(body))
    return HttpResponse.json({ run_id: runId, status: 'running' })
  }),

  http.get('*/api/v1/backtest/:runId/result', ({ params }) => {
    const result = mockBacktestJobs.get(params.runId as string)
    if (!result) {
      return HttpResponse.json({ detail: 'Backtest result not found.' }, { status: 404 })
    }
    return HttpResponse.json({ ...result, run_id: params.runId })
  }),

  http.get('*/api/v1/backtest/:runId', ({ params }) => {
    const runId = params.runId as string
    if (!mockBacktestJobs.has(runId)) {
      return HttpResponse.json({ detail: 'Backtest run not found.' }, { status: 404 })
    }
    return HttpResponse.json({ run_id: runId, status: 'completed', error: null })
  }),

  http.get('*/api/v1/backtests', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
    const symbol = url.searchParams.get('symbol')?.toUpperCase()
    const strategy = url.searchParams.get('strategy') ?? undefined
    const savedOnly = url.searchParams.get('saved_only') === 'true'
    const sort = url.searchParams.get('sort') ?? 'created_at_desc'

    let items = mockBacktestRunSummaries
      .filter((run) => !deletedBacktestRunIds.has(run.run_id))
      .map((run) => ({
        ...run,
        is_saved: savedBacktestRunOverrides.get(run.run_id) ?? run.is_saved,
      }))

    if (symbol) {
      items = items.filter((run) => run.symbol.toUpperCase() === symbol)
    }
    if (strategy) {
      items = items.filter((run) => run.strategy === strategy)
    }
    if (savedOnly) {
      items = items.filter((run) => run.is_saved)
    }

    if (sort === 'pnl_desc') {
      items = [...items].sort((a, b) => {
        const aPnl = a.summary?.total_pnl ?? Number.NEGATIVE_INFINITY
        const bPnl = b.summary?.total_pnl ?? Number.NEGATIVE_INFINITY
        if (a.summary?.total_pnl == null && b.summary?.total_pnl == null) return 0
        if (a.summary?.total_pnl == null) return 1
        if (b.summary?.total_pnl == null) return -1
        return bPnl - aPnl
      })
    } else if (sort === 'pnl_asc') {
      items = [...items].sort((a, b) => {
        if (a.summary?.total_pnl == null && b.summary?.total_pnl == null) return 0
        if (a.summary?.total_pnl == null) return 1
        if (b.summary?.total_pnl == null) return -1
        return (a.summary?.total_pnl ?? 0) - (b.summary?.total_pnl ?? 0)
      })
    } else {
      items = [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }

    return HttpResponse.json({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    })
  }),

  http.patch('*/api/v1/backtests/:runId', async ({ params, request }) => {
    const runId = String(params.runId)
    if (deletedBacktestRunIds.has(runId)) {
      return HttpResponse.json({ detail: `Backtest run '${runId}' not found.` }, { status: 404 })
    }
    const body = (await request.json()) as { is_saved?: boolean }
    const detail = getMockBacktestRunDetail(runId)
    if (!detail || body.is_saved == null) {
      return HttpResponse.json({ detail: `Backtest run '${runId}' not found.` }, { status: 404 })
    }
    savedBacktestRunOverrides.set(runId, body.is_saved)
    return HttpResponse.json({ ...detail, is_saved: body.is_saved })
  }),

  http.post('*/api/v1/backtests/bulk-delete', async ({ request }) => {
    const body = (await request.json()) as { run_ids?: string[] }
    const runIds = body.run_ids ?? []
    let deleted = 0
    const notFound: string[] = []

    for (const runId of runIds) {
      const exists = mockBacktestRunSummaries.some((run) => run.run_id === runId)
      if (!exists || deletedBacktestRunIds.has(runId)) {
        notFound.push(runId)
        continue
      }
      deletedBacktestRunIds.add(runId)
      deleted += 1
    }

    return HttpResponse.json({ deleted, not_found: notFound })
  }),

  http.get('*/api/v1/backtests/:runId', ({ params }) => {
    const runId = String(params.runId)
    if (deletedBacktestRunIds.has(runId)) {
      return HttpResponse.json({ detail: `Backtest run '${runId}' not found.` }, { status: 404 })
    }
    const detail = getMockBacktestRunDetail(runId)
    if (!detail) {
      return HttpResponse.json({ detail: `Backtest run '${runId}' not found.` }, { status: 404 })
    }
    return HttpResponse.json({
      ...detail,
      is_saved: savedBacktestRunOverrides.get(runId) ?? detail.is_saved,
    })
  }),

  http.delete('*/api/v1/backtests/:runId', ({ params }) => {
    const runId = String(params.runId)
    const exists = mockBacktestRunSummaries.some((run) => run.run_id === runId)
    if (!exists || deletedBacktestRunIds.has(runId)) {
      return HttpResponse.json({ detail: `Backtest run '${runId}' not found.` }, { status: 404 })
    }
    deletedBacktestRunIds.add(runId)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/v1/backtests/:runId/artifacts/equity', ({ params }) => {
    const runId = String(params.runId)
    if (deletedBacktestRunIds.has(runId)) {
      return HttpResponse.json({ detail: `Backtest run '${runId}' not found.` }, { status: 404 })
    }
    const artifact = getMockBacktestEquityArtifact(runId)
    if (!artifact) {
      return HttpResponse.json(
        { detail: `Backtest artifact 'equity' not found for run '${runId}'.` },
        { status: 404 },
      )
    }
    return HttpResponse.json(artifact)
  }),

  http.get('*/api/v1/optimizations', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    const items = mockOptimizationStudySummaries.filter(
      (study) => !deletedOptimizationStudyIds.has(study.study_id),
    )

    return HttpResponse.json({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    })
  }),

  // POST /api/v1/optimize - start optimization
  http.post('*/api/v1/optimize', async ({ request }) => {
    const body = (await request.json()) as {
      study?: { n_trials?: number }
      objective?: { mode?: string }
    }
    const studyId = `study_${Math.random().toString(36).substring(2, 11)}`
    const n_trials = body?.study?.n_trials ?? 50
    const objectiveMode = body?.objective?.mode ?? 'maximize_sharpe'

    const { trials, best_trial, best_params } = generateMockTrials(n_trials, objectiveMode)
    const bestValue = best_trial?.values?.[0] ?? null

    const newStudy: MockStudyState = {
      study_id: studyId,
      status: 'pending',
      completed_trials: 0,
      n_trials,
      best_value: bestValue,
      best_params,
      objective_mode: objectiveMode,
      start_time: Date.now(),
      trials,
      best_trial,
    }

    mockStudies.set(studyId, newStudy)

    return HttpResponse.json({
      study_id: studyId,
      status: 'pending',
    })
  }),

  // GET /api/v1/optimize/:study_id - get status
  http.get('*/api/v1/optimize/:study_id', ({ params }) => {
    const studyId = String(params.study_id)
    if (deletedOptimizationStudyIds.has(studyId)) {
      return HttpResponse.json({ detail: `Study '${studyId}' not found.` }, { status: 404 })
    }
    const study = getUpdatedStudy(studyId)

    if (study) {
      return HttpResponse.json({
        study_id: study.study_id,
        status: study.status,
        completed_trials: study.completed_trials,
        n_trials: study.n_trials,
        best_value: study.status === 'pending' ? null : study.best_value,
        best_params: study.status === 'pending' ? {} : study.best_params,
        error: null,
      })
    }

    const staticStatus = getMockOptimizationStatus(studyId)
    if (staticStatus) {
      return HttpResponse.json(staticStatus)
    }

    return new HttpResponse('Study not found', { status: 404 })
  }),

  // POST /api/v1/optimize/:study_id/cancel - cancel optimization
  http.post('*/api/v1/optimize/:study_id/cancel', ({ params }) => {
    const studyId = String(params.study_id)
    if (deletedOptimizationStudyIds.has(studyId)) {
      return HttpResponse.json({ detail: `Study '${studyId}' not found.` }, { status: 404 })
    }
    const study = mockStudies.get(studyId)

    if (!study) {
      return new HttpResponse('Study not found', { status: 404 })
    }

    study.status = 'cancelled'

    return HttpResponse.json({
      study_id: study.study_id,
      status: 'cancelled',
      completed_trials: study.completed_trials,
      n_trials: study.n_trials,
      best_value: study.best_value,
      best_params: study.best_params,
      error: null,
    })
  }),

  http.post('*/api/v1/optimizations/bulk-delete', async ({ request }) => {
    const body = (await request.json()) as { study_ids?: string[] }
    const studyIds = body.study_ids ?? []
    let deleted = 0
    const notFound: string[] = []

    for (const studyId of studyIds) {
      const exists = mockOptimizationStudySummaries.some((study) => study.study_id === studyId)
      if (!exists || deletedOptimizationStudyIds.has(studyId)) {
        notFound.push(studyId)
        continue
      }
      deletedOptimizationStudyIds.add(studyId)
      deleted += 1
    }

    return HttpResponse.json({ deleted, not_found: notFound })
  }),

  http.delete('*/api/v1/optimizations/:studyId', ({ params }) => {
    const studyId = String(params.studyId)
    const exists = mockOptimizationStudySummaries.some((study) => study.study_id === studyId)
    if (!exists || deletedOptimizationStudyIds.has(studyId)) {
      return HttpResponse.json({ detail: `Study '${studyId}' not found.` }, { status: 404 })
    }
    deletedOptimizationStudyIds.add(studyId)
    return new HttpResponse(null, { status: 204 })
  }),

  // GET /api/v1/optimize/:study_id/results - get results
  http.get('*/api/v1/optimize/:study_id/results', ({ params }) => {
    const studyId = String(params.study_id)
    if (deletedOptimizationStudyIds.has(studyId)) {
      return HttpResponse.json({ detail: `Study '${studyId}' not found.` }, { status: 404 })
    }
    const study = getUpdatedStudy(studyId)

    if (study) {
      // Return partial trials if cancelled, or all trials if completed
      const activeTrialsCount = study.completed_trials
      const sliceTrials = study.trials.slice(0, activeTrialsCount)

      // Calculate best trial and best params from the active slice
      let bestSliceTrial: OptimizationTrial | null = null
      let bestSliceValue = study.objective_mode.includes('minimize') ? Infinity : -Infinity
      for (const t of sliceTrials) {
        const val = t.values?.[0] ?? 0
        const isBetter = study.objective_mode.includes('minimize')
          ? val < bestSliceValue
          : val > bestSliceValue
        if (isBetter) {
          bestSliceValue = val
          bestSliceTrial = t
        }
      }

      // Filter high-performance trials for pareto trials mockup (e.g. top 5 trials in slice)
      const paretoTrials = [...sliceTrials]
        .sort((a, b) => {
          const valA = a.values?.[0] ?? -Infinity
          const valB = b.values?.[0] ?? -Infinity
          return valB - valA // Maximize
        })
        .slice(0, Math.min(5, Math.ceil(activeTrialsCount / 5)))

      return HttpResponse.json({
        study_id: study.study_id,
        objective_mode: study.objective_mode,
        is_multi_objective: study.objective_mode === 'multi_objective_return_drawdown',
        best_params: bestSliceTrial ? bestSliceTrial.params : {},
        best_trial: bestSliceTrial,
        trials: sliceTrials,
        pareto_trials: paretoTrials,
        failures: [],
      })
    }

    const staticResults = getMockOptimizationResults(studyId)
    if (staticResults) {
      return HttpResponse.json(staticResults)
    }

    return new HttpResponse('Study not found', { status: 404 })
  }),

  http.get('*/api/v1/walkforwards', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    const items = mockWalkForwardRunSummaries.filter(
      (run) => !deletedWalkForwardRunIds.has(run.run_id),
    )

    return HttpResponse.json({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    })
  }),

  http.post('*/api/v1/walkforward', async ({ request }) => {
    const body = await request.json()
    const runId = `wf_${Math.random().toString(36).substring(2, 11)}`
    const wf = (body as { walkforward?: { min_windows?: number } }).walkforward
    const totalWindows = wf?.min_windows ?? 2

    mockWalkForwardJobs.set(runId, {
      run_id: runId,
      status: 'pending',
      total_windows: totalWindows,
      start_time: Date.now(),
      request_body: body,
    })

    return HttpResponse.json({ run_id: runId, status: 'pending' })
  }),

  http.get('*/api/v1/walkforward/:runId', ({ params }) => {
    const runId = String(params.runId)
    if (deletedWalkForwardRunIds.has(runId)) {
      return HttpResponse.json(
        { detail: `Walk-forward run '${runId}' not found.` },
        { status: 404 },
      )
    }

    const job = getUpdatedWalkForwardJob(runId)
    if (job) {
      return HttpResponse.json(walkForwardStatusFromJob(job))
    }

    const staticStatus = getMockWalkForwardStatus(runId)
    if (staticStatus) {
      return HttpResponse.json(staticStatus)
    }

    return HttpResponse.json({ detail: `Walk-forward run '${runId}' not found.` }, { status: 404 })
  }),

  http.get('*/api/v1/walkforward/:runId/results', ({ params }) => {
    const runId = String(params.runId)
    if (deletedWalkForwardRunIds.has(runId)) {
      return HttpResponse.json(
        { detail: `Walk-forward run '${runId}' not found.` },
        { status: 404 },
      )
    }

    const job = getUpdatedWalkForwardJob(runId)
    if (job && (job.status === 'completed' || job.status === 'cancelled')) {
      return HttpResponse.json(walkForwardResultsFromJob(job))
    }

    const staticResults = getMockWalkForwardResults(runId)
    if (staticResults) {
      return HttpResponse.json(staticResults)
    }

    return HttpResponse.json({ detail: `Walk-forward run '${runId}' not found.` }, { status: 404 })
  }),

  http.get('*/api/v1/walkforward/:runId/artifacts/equity', ({ params }) => {
    const runId = String(params.runId)
    const results = getMockWalkForwardResults(runId)
    const job = getUpdatedWalkForwardJob(runId)
    const points =
      results?.equity_curve ??
      (job && job.status === 'completed'
        ? (getMockWalkForwardResults('wf-run-win-ma')?.equity_curve ?? [])
        : [])

    if (points.length === 0) {
      return HttpResponse.json(
        { detail: `Equity artifact not found for walk-forward run '${runId}'.` },
        { status: 404 },
      )
    }

    return HttpResponse.json({ run_id: runId, points })
  }),

  http.post('*/api/v1/walkforward/:runId/cancel', ({ params }) => {
    const runId = String(params.runId)
    const job = mockWalkForwardJobs.get(runId)
    if (!job) {
      return HttpResponse.json(
        { detail: `Walk-forward run '${runId}' not found.` },
        { status: 404 },
      )
    }
    job.status = 'cancelled'
    return HttpResponse.json(walkForwardStatusFromJob(job))
  }),

  http.delete('*/api/v1/walkforwards/:runId', ({ params }) => {
    const runId = String(params.runId)
    const exists =
      mockWalkForwardRunSummaries.some((run) => run.run_id === runId) ||
      mockWalkForwardJobs.has(runId)
    if (!exists || deletedWalkForwardRunIds.has(runId)) {
      return HttpResponse.json(
        { detail: `Walk-forward run '${runId}' not found.` },
        { status: 404 },
      )
    }
    deletedWalkForwardRunIds.add(runId)
    mockWalkForwardJobs.delete(runId)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/v1/strategy-searches', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    const items = mockStrategySearchRunSummaries.filter(
      (run) => !deletedStrategySearchRunIds.has(run.run_id),
    )

    return HttpResponse.json({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    })
  }),

  http.post('*/api/v1/strategy-search', async ({ request }) => {
    const body = await request.json()
    const runId = `ss_${Math.random().toString(36).substring(2, 11)}`
    const config = body as {
      strategies?: string[] | null
      genetic?: { population_size: number; generations: number }
    }
    const isGenetic = config.genetic != null
    const totalCandidates = isGenetic
      ? config.genetic!.population_size * config.genetic!.generations
      : (config.strategies?.length ??
        (mockStrategies.strategies.filter((s) => (s.engine ?? 'candle') === 'candle').length || 3))

    mockStrategySearchJobs.set(runId, {
      run_id: runId,
      status: 'pending',
      total_candidates: totalCandidates,
      total_generations: isGenetic ? config.genetic!.generations : undefined,
      start_time: Date.now(),
      request_body: body,
      is_genetic: isGenetic,
    })

    return HttpResponse.json({ run_id: runId, status: 'pending' })
  }),

  http.get('*/api/v1/strategy-search/:runId', ({ params }) => {
    const runId = String(params.runId)
    if (deletedStrategySearchRunIds.has(runId)) {
      return HttpResponse.json(
        { detail: `Strategy search run '${runId}' not found.` },
        { status: 404 },
      )
    }

    const job = getUpdatedStrategySearchJob(runId)
    if (job) {
      return HttpResponse.json(strategySearchStatusFromJob(job))
    }

    const staticStatus = getMockStrategySearchStatus(runId)
    if (staticStatus) {
      return HttpResponse.json(staticStatus)
    }

    return HttpResponse.json(
      { detail: `Strategy search run '${runId}' not found.` },
      { status: 404 },
    )
  }),

  http.get('*/api/v1/strategy-search/:runId/results', ({ params }) => {
    const runId = String(params.runId)
    if (deletedStrategySearchRunIds.has(runId)) {
      return HttpResponse.json(
        { detail: `Strategy search run '${runId}' not found.` },
        { status: 404 },
      )
    }

    const job = getUpdatedStrategySearchJob(runId)
    if (job && (job.status === 'completed' || job.status === 'cancelled')) {
      return HttpResponse.json(strategySearchResultsFromJob(job))
    }

    const staticResults = getMockStrategySearchResults(runId)
    if (staticResults) {
      return HttpResponse.json(staticResults)
    }

    return HttpResponse.json(
      { detail: `Strategy search run '${runId}' not found.` },
      { status: 404 },
    )
  }),

  http.get(
    '*/api/v1/strategy-search/:runId/candidates/:candidateId/artifacts/equity',
    ({ params }) => {
      const runId = String(params.runId)
      const candidateId = String(params.candidateId)
      const points = getMockCandidateEquityPoints(runId, candidateId)

      if (points.length === 0) {
        return HttpResponse.json(
          {
            detail: `Equity artifact not found for candidate '${candidateId}' in run '${runId}'.`,
          },
          { status: 404 },
        )
      }

      return HttpResponse.json({ run_id: runId, candidate_id: candidateId, points })
    },
  ),

  http.get('*/api/v1/strategy-search/:runId/candidates/:candidateId/genome', ({ params }) => {
    const runId = String(params.runId)
    const candidateId = String(params.candidateId)
    const genome = getMockCandidateGenome(runId, candidateId)

    if (!genome) {
      return HttpResponse.json(
        {
          detail: `Genome not found for candidate '${candidateId}' in run '${runId}'.`,
        },
        { status: 404 },
      )
    }

    return HttpResponse.json({ run_id: runId, candidate_id: candidateId, genome })
  }),

  http.post('*/api/v1/strategy-search/:runId/cancel', ({ params }) => {
    const runId = String(params.runId)
    const job = mockStrategySearchJobs.get(runId)
    if (!job) {
      return HttpResponse.json(
        { detail: `Strategy search run '${runId}' not found.` },
        { status: 404 },
      )
    }
    job.status = 'cancelled'
    return HttpResponse.json(strategySearchStatusFromJob(job))
  }),

  http.delete('*/api/v1/strategy-searches/:runId', ({ params }) => {
    const runId = String(params.runId)
    const exists =
      mockStrategySearchRunSummaries.some((run) => run.run_id === runId) ||
      mockStrategySearchJobs.has(runId)
    if (!exists || deletedStrategySearchRunIds.has(runId)) {
      return HttpResponse.json(
        { detail: `Strategy search run '${runId}' not found.` },
        { status: 404 },
      )
    }
    deletedStrategySearchRunIds.add(runId)
    mockStrategySearchJobs.delete(runId)
    return new HttpResponse(null, { status: 204 })
  }),
]

// Keep track of active study mocks
type MockStudyState = {
  study_id: string
  status: 'pending' | 'running' | 'done' | 'cancelled'
  completed_trials: number
  n_trials: number
  best_value: number | null
  best_params: Record<string, unknown>
  objective_mode: string
  start_time: number
  trials: OptimizationTrial[]
  best_trial: OptimizationTrial | null
}

const mockStudies = new Map<string, MockStudyState>()

const getUpdatedStudy = (studyId: string): MockStudyState | undefined => {
  const study = mockStudies.get(studyId)
  if (!study) return undefined
  if (study.status === 'cancelled' || study.status === 'done') return study

  const elapsed = Date.now() - study.start_time
  if (elapsed < 1000) {
    study.status = 'pending'
    study.completed_trials = 0
  } else if (elapsed < 6000) {
    study.status = 'running'
    study.completed_trials = Math.min(
      study.n_trials - 1,
      Math.floor(((elapsed - 1000) / 5000) * study.n_trials),
    )
  } else {
    study.status = 'done'
    study.completed_trials = study.n_trials
  }
  return study
}

function generateMockTrials(n_trials: number, objectiveMode: string) {
  const trials: OptimizationTrial[] = []
  let bestTrial: OptimizationTrial | null = null
  let bestValue = objectiveMode.includes('minimize') ? Infinity : -Infinity

  for (let i = 0; i < n_trials; i++) {
    // Generate parameters: short_period (5-25), long_period (25-60), threshold (0.01-0.08), quantity (0.1-2.5)
    const short_period = 5 + Math.floor(Math.random() * 21)
    const long_period = 25 + Math.floor(Math.random() * 36)
    const threshold = 0.01 + Math.random() * 0.07
    const quantity = 0.1 + Math.random() * 2.4

    // Parabolic relationship for Sharpe: peak near short_period=12, long_period=35, threshold=0.03
    const xDist = (short_period - 12) / 8
    const yDist = (long_period - 35) / 15
    const zDist = (threshold - 0.03) / 0.02

    const baseSharpe = 2.2 - xDist * xDist - yDist * yDist - zDist * zDist
    const noise = (Math.random() - 0.5) * 0.4
    const sharpe = Math.max(-0.5, baseSharpe + noise)

    const basePnl = 15000 * (sharpe + 0.5)
    const total_pnl = basePnl + (Math.random() - 0.5) * 2000
    const max_drawdown_pct = Math.max(2.0, 25.0 - 5.0 * sharpe + Math.random() * 3.0)

    let val = sharpe
    if (objectiveMode === 'maximize_net_profit') {
      val = total_pnl
    } else if (objectiveMode === 'minimize_drawdown') {
      val = max_drawdown_pct
    } else if (
      objectiveMode === 'maximize_return_drawdown' ||
      objectiveMode === 'multi_objective_return_drawdown'
    ) {
      val = total_pnl / max_drawdown_pct
    }

    const values = [val]
    if (objectiveMode === 'multi_objective_return_drawdown') {
      values.push(max_drawdown_pct)
    }

    const params = {
      short_period,
      long_period,
      threshold,
      quantity,
    }

    const trial = {
      number: i,
      params,
      values,
      state: 'COMPLETE',
      user_attrs: {
        status: 'COMPLETE',
        metrics: {
          total_pnl,
          sharpe_ratio: sharpe,
          max_drawdown_pct,
        },
        strategy_params: {
          short_period,
          long_period,
        },
        risk_params: {
          type: 'fixed_quantity',
          quantity,
          threshold,
        },
      },
    }

    trials.push(trial)

    const isBetter = objectiveMode.includes('minimize') ? val < bestValue : val > bestValue

    if (isBetter) {
      bestValue = val
      bestTrial = trial
    }
  }

  return {
    trials,
    best_trial: bestTrial,
    best_params: bestTrial ? bestTrial.params : {},
  }
}
