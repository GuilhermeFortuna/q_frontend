import { http, HttpResponse } from 'msw'

import { getMockBacktestResponse } from '@/mocks/backtest'
import { getMockOhlcv, mockInstruments, mockSnapshots, mockSystemHealth } from '@/mocks/data'
import type { BacktestRequest } from '@/types/backtesting'

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

  http.get('*/api/v1/market/ohlcv/:symbol', ({ params, request }) => {
    const symbol = String(params.symbol).toUpperCase()
    const url = new URL(request.url)
    const timeframe = url.searchParams.get('timeframe') ?? 'D1'
    const count = parseInt(url.searchParams.get('count') ?? '500', 10)
    return HttpResponse.json(getMockOhlcv(symbol, timeframe, count))
  }),

  http.post('*/api/v1/backtest/run', async ({ request }) => {
    const body = (await request.json()) as BacktestRequest
    return HttpResponse.json(getMockBacktestResponse(body))
  }),
]
