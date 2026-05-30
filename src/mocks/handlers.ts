import { http, HttpResponse } from 'msw'

import { getMockOhlcv, mockInstruments, mockSnapshots, mockSystemHealth } from '@/mocks/data'

export const handlers = [
  http.get('*/api/v1/system/health', () => HttpResponse.json(mockSystemHealth)),

  http.get('*/api/v1/market/instruments', () => HttpResponse.json(mockInstruments)),

  http.get('*/api/v1/market/snapshot/:symbol', ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    const snapshot = mockSnapshots[symbol]
    if (!snapshot) {
      return HttpResponse.json({ message: 'Instrument not found' }, { status: 404 })
    }
    return HttpResponse.json(snapshot)
  }),

  http.get('*/api/v1/market/ohlcv/:symbol', ({ params }) => {
    const symbol = String(params.symbol).toUpperCase()
    if (!mockSnapshots[symbol]) {
      return HttpResponse.json({ message: 'Instrument not found' }, { status: 404 })
    }
    return HttpResponse.json(getMockOhlcv(symbol))
  }),
]
