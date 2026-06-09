import { http, HttpResponse } from 'msw'

import { getMockBacktestResponse } from '@/mocks/backtest'
import {
  getMockBacktestRunDetail,
  getMockOptimizationResults,
  getMockOptimizationStatus,
  getMockOhlcv,
  mockBacktestRunSummaries,
  mockInstruments,
  mockOptimizationStudySummaries,
  mockSnapshots,
  mockSystemHealth,
} from '@/mocks/data'
import type { BacktestRequest } from '@/types/backtesting'

const deletedBacktestRunIds = new Set<string>()

export function resetMockBacktestDeletes() {
  deletedBacktestRunIds.clear()
}

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

  http.get('*/api/v1/backtests', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
    const symbol = url.searchParams.get('symbol')?.toUpperCase()

    let items = mockBacktestRunSummaries.filter((run) => !deletedBacktestRunIds.has(run.run_id))
    if (symbol) {
      items = items.filter((run) => run.symbol.toUpperCase() === symbol)
    }

    return HttpResponse.json({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    })
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
    return HttpResponse.json(detail)
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

  http.get('*/api/v1/optimizations', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    return HttpResponse.json({
      items: mockOptimizationStudySummaries.slice(offset, offset + limit),
      total: mockOptimizationStudySummaries.length,
      limit,
      offset,
    })
  }),

  http.get('*/api/v1/optimize/:studyId/results', ({ params }) => {
    const studyId = String(params.studyId)
    const results = getMockOptimizationResults(studyId)
    if (!results) {
      const status = getMockOptimizationStatus(studyId)
      if (status?.status === 'error') {
        return HttpResponse.json(
          { detail: `Study '${studyId}' has no results yet (status: error).` },
          { status: 409 },
        )
      }
      return HttpResponse.json({ detail: `Study '${studyId}' not found.` }, { status: 404 })
    }
    return HttpResponse.json(results)
  }),

  http.get('*/api/v1/optimize/:studyId', ({ params }) => {
    const studyId = String(params.studyId)
    const status = getMockOptimizationStatus(studyId)
    if (!status) {
      return HttpResponse.json({ detail: `Study '${studyId}' not found.` }, { status: 404 })
    }
    return HttpResponse.json(status)
  }),

  http.post('*/api/v1/optimize', async () => {
    const studyId = `study-${Date.now()}`
    return HttpResponse.json({ study_id: studyId, status: 'pending' as const })
  }),

  http.post('*/api/v1/optimize/:studyId/cancel', ({ params }) => {
    const studyId = String(params.studyId)
    const status = getMockOptimizationStatus(studyId)
    if (!status) {
      return HttpResponse.json({ detail: `Study '${studyId}' not found.` }, { status: 404 })
    }
    return HttpResponse.json({ ...status, status: 'cancelled' as const })
  }),
]
