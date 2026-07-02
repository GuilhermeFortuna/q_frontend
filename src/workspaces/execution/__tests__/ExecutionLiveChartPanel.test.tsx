import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { handlers } from '@/mocks/handlers'
import { resetMockExecutionState } from '@/mocks/execution'
import { ExecutionLiveChartPanel } from '@/workspaces/execution/ExecutionLiveChartPanel'
import { renderWithQueryClient } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)
const DEPLOYMENT_ID = '22222222-2222-2222-2222-222222222222'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockExecutionState())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPanel() {
  return renderWithQueryClient(
    <ExecutionLiveChartPanel deploymentId={DEPLOYMENT_ID} symbol="WIN$" pollingEnabled />,
  )
}

describe('ExecutionLiveChartPanel', () => {
  it('renders the chart, bar-close note and countdown', async () => {
    renderPanel()
    expect(await screen.findByTestId('live-strategy-chart')).toBeInTheDocument()
    expect(screen.getByTestId('live-chart-bar-close-note')).toBeInTheDocument()
    expect(screen.getByTestId('live-chart-countdown')).toBeInTheDocument()
    expect(screen.getByTestId('live-chart-symbol')).toHaveTextContent(/WIN\$ · H1/)
  })

  it('shows the unavailable state on a 404 (pre-WO175 backend)', async () => {
    server.use(
      http.get('*/api/v1/execution/deployments/:id/chart', () =>
        HttpResponse.json({ detail: 'not found' }, { status: 404 }),
      ),
    )
    renderPanel()
    expect(await screen.findByTestId('live-chart-unavailable')).toBeInTheDocument()
  })

  it('shows a market-unavailable note (not an error wall) on an initial 503', async () => {
    server.use(
      http.get('*/api/v1/execution/deployments/:id/chart', () =>
        HttpResponse.json({ detail: 'market data unavailable' }, { status: 503 }),
      ),
    )
    renderPanel()
    // The hook retries a 503 once, so allow the loading→error transition to settle.
    expect(
      await screen.findByTestId('live-chart-market-unavailable', {}, { timeout: 5_000 }),
    ).toBeInTheDocument()
  })

  it('retains the last chart with a stale note when market data drops (503)', async () => {
    const { queryClient } = renderPanel()
    await screen.findByTestId('live-strategy-chart')

    server.use(
      http.get('*/api/v1/execution/deployments/:id/chart', () =>
        HttpResponse.json({ detail: 'market data unavailable' }, { status: 503 }),
      ),
    )
    await queryClient.invalidateQueries()

    await waitFor(() => expect(screen.getByTestId('live-chart-stale-note')).toBeInTheDocument())
    // Chart is still shown — never replaced by an error wall.
    expect(screen.getByTestId('live-strategy-chart')).toBeInTheDocument()
  })
})
