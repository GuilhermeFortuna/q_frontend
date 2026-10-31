import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { BacktestHistoryPanel } from '@/components/backtests/BacktestHistoryPanel'
import { handlers } from '@/mocks/handlers'
import { MOCK_STRATEGY_FILE_BUNDLE_HASH, MOCK_STRATEGY_VERSION_ID } from '@/mocks/strategyFiles'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const RUN_ID = 'run-strategy-file-1'
const CONFIG = {
  symbol: 'IND$N',
  timeframe: 'M5',
  start: '2024-01-01T00:00:00-03:00',
  end: '2024-06-01T00:00:00-03:00',
  initial_capital: 100000,
  point_value: 1,
  strategy_version_id: MOCK_STRATEGY_VERSION_ID,
  strategy_params: { range_bars: 12, enter_after: '10:00', use_filter: true },
  day_trade: false,
  research_data_mode: 'ticks' as const,
}

describe('BacktestHistoryPanel strategy-file runs', () => {
  it('shows the strategy id and bundle hash, and Re-run posts the stored version', async () => {
    const user = userEvent.setup()
    const onReRun = vi.fn()
    server.use(
      http.get('*/api/v1/backtests', () =>
        HttpResponse.json({
          items: [
            {
              run_id: RUN_ID,
              symbol: 'IND$N',
              strategy: 'session_breakout',
              timeframe: 'M5',
              status: 'completed',
              created_at: '2026-10-29T14:31:00-03:00',
              is_saved: false,
              origin: 'stack',
              summary: null,
              strategy_version_id: MOCK_STRATEGY_VERSION_ID,
              strategy_bundle_hash: MOCK_STRATEGY_FILE_BUNDLE_HASH,
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.get('*/api/v1/backtests/:runId', () =>
        HttpResponse.json({
          run_id: RUN_ID,
          symbol: 'IND$N',
          strategy: 'session_breakout',
          timeframe: 'M5',
          status: 'completed',
          config: CONFIG,
          result_summary: null,
          error_message: null,
          started_at: null,
          finished_at: null,
          created_at: '2026-10-29T14:31:00-03:00',
          is_saved: false,
          origin: 'stack',
          provenance: null,
          strategy_version_id: MOCK_STRATEGY_VERSION_ID,
          strategy_bundle_hash: MOCK_STRATEGY_FILE_BUNDLE_HASH,
        }),
      ),
    )

    renderWithQueryClient(
      <BacktestHistoryPanel selectedRunId={RUN_ID} onSelectRun={vi.fn()} onReRun={onReRun} />,
    )

    await waitFor(() => {
      expect(screen.getAllByText(/3f9a1c0d/).length).toBeGreaterThan(0)
    })

    await waitFor(() => {
      expect(screen.getByTestId('run-strategy-version')).toHaveTextContent('3f9a1c0d')
    })
    await user.click(screen.getByRole('button', { name: /Re-run simulation/i }))

    expect(onReRun).toHaveBeenCalledTimes(1)
    const request = onReRun.mock.calls[0]![0] as Record<string, unknown>
    expect(request.strategy_version_id).toBe(MOCK_STRATEGY_VERSION_ID)
    expect(request.strategy).toBeUndefined()
    expect(request.research_data_mode).toBe('ticks')
    expect(within(document.body).queryByText(/Strategy file · 3f9a1c0d/)).toBeInTheDocument()
  })
})
