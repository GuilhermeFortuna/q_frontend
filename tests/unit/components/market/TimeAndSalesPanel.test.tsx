import { screen, waitFor } from '@testing-library/react'
import { format, parseISO } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { TimeAndSalesPanel } from '@/components/market/TimeAndSalesPanel'
import { handlers } from '@/mocks/handlers'
import { renderWithQueryClient } from '../../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('TimeAndSalesPanel', () => {
  it('renders ticks newest-first', async () => {
    server.use(
      http.get('*/api/v1/market/ticks/:symbol', () =>
        HttpResponse.json({
          ticks: [
            {
              timestamp: '2026-06-09T14:32:09.000Z',
              bid: 41.0,
              ask: 41.02,
              last: 41.01,
              volume: 100,
              side: null,
            },
            {
              timestamp: '2026-06-09T14:32:10.000Z',
              bid: 41.01,
              ask: 41.03,
              last: 41.02,
              volume: 200,
              side: 'sell',
            },
            {
              timestamp: '2026-06-09T14:32:11.000Z',
              bid: 41.02,
              ask: 41.04,
              last: 41.03,
              volume: 300,
              side: 'buy',
            },
          ],
        }),
      ),
    )

    renderWithQueryClient(<TimeAndSalesPanel symbol="PETR4" enabled priceDigits={2} />)

    await waitFor(() => {
      expect(screen.getByText('41.03')).toBeInTheDocument()
    })

    const prices = screen.getAllByText(/41\.0[123]/).map((element) => element.textContent)
    expect(prices[0]).toBe('41.03')
    expect(prices[prices.length - 1]).toBe('41.01')
    expect(
      screen.getByText(format(parseISO('2026-06-09T14:32:11.000Z'), 'HH:mm:ss')),
    ).toBeInTheDocument()
    expect(
      screen.getByText(format(parseISO('2026-06-09T14:32:09.000Z'), 'HH:mm:ss')),
    ).toBeInTheDocument()
  })

  it('shows an empty state when no ticks are returned', async () => {
    server.use(http.get('*/api/v1/market/ticks/:symbol', () => HttpResponse.json({ ticks: [] })))

    renderWithQueryClient(<TimeAndSalesPanel symbol="PETR4" enabled />)

    await waitFor(() => {
      expect(screen.getByText('No trades in feed.')).toBeInTheDocument()
    })
  })
})
