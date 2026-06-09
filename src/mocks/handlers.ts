import { http, HttpResponse } from 'msw'

import { getMockBacktestResponse } from '@/mocks/backtest'
import { getMockOhlcv, mockInstruments, mockSnapshots, mockSystemHealth } from '@/mocks/data'
import type { BacktestRequest } from '@/types/backtesting'
import type { OptimizationTrial } from '@/types/optimization'

export const handlers = [
  http.get('*/api/v1/system/health', () => HttpResponse.json(mockSystemHealth)),

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

  http.get('*/api/v1/market/snapshot/:symbol', ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    const snapshot = mockSnapshots[symbol] || {
      symbol,
      last: symbol.includes('WIN') ? 128000 : symbol.includes('WDO') ? 5100 : 50.0,
      changePct: 0.5,
      volume: 15000,
    }
    return HttpResponse.json(snapshot)
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
    const study = getUpdatedStudy(studyId)

    if (!study) {
      return new HttpResponse('Study not found', { status: 404 })
    }

    return HttpResponse.json({
      study_id: study.study_id,
      status: study.status,
      completed_trials: study.completed_trials,
      n_trials: study.n_trials,
      best_value: study.status === 'pending' ? null : study.best_value,
      best_params: study.status === 'pending' ? {} : study.best_params,
      error: null,
    })
  }),

  // POST /api/v1/optimize/:study_id/cancel - cancel optimization
  http.post('*/api/v1/optimize/:study_id/cancel', ({ params }) => {
    const studyId = String(params.study_id)
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

  // GET /api/v1/optimize/:study_id/results - get results
  http.get('*/api/v1/optimize/:study_id/results', ({ params }) => {
    const studyId = String(params.study_id)
    const study = getUpdatedStudy(studyId)

    if (!study) {
      return new HttpResponse('Study not found', { status: 404 })
    }

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
