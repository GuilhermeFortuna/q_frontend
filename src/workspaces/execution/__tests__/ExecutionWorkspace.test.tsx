import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { handlers } from '@/mocks/handlers'
import { resetMockExecutionState, setMockExecutionScenario } from '@/mocks/execution'
import { ExecutionWorkspace } from '@/workspaces/execution/ExecutionWorkspace'
import { renderWithQueryClient } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockExecutionState()
  vi.useRealTimers()
})
afterAll(() => server.close())

describe('ExecutionWorkspace', () => {
  it('shows paper and live-locked badges with separate health signals', async () => {
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)

    expect(await screen.findByTestId('execution-paper-badge')).toHaveTextContent(/paper/i)
    expect(screen.getByTestId('execution-live-locked-badge')).toHaveTextContent(/live locked/i)
    expect(await screen.findByTestId('execution-health-panel')).toBeInTheDocument()
  })

  it('surfaces worker-down when API is ok but worker is offline', async () => {
    setMockExecutionScenario('worker_offline')
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)

    expect(await screen.findByTestId('execution-worker-down-banner')).toBeInTheDocument()
  })

  it('shows retained-position language on lifecycle controls', async () => {
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    expect(await screen.findByTestId('execution-retained-position-note')).toHaveTextContent(
      /open positions remain/i,
    )
  })

  it('requires confirmation before flatten and sends confirm:true', async () => {
    const actionSpy = vi.fn()
    server.use(
      http.post('*/api/v1/execution/deployments/:id/actions', async ({ request }) => {
        const body = (await request.json()) as { action: string; confirm?: boolean }
        actionSpy(body)
        return HttpResponse.json({
          accepted: true,
          deployment_id: '22222222-2222-2222-2222-222222222222',
          lifecycle: 'running',
          pending_action: 'flatten',
          message: 'flatten queued for worker',
        })
      }),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await waitFor(() => expect(screen.queryByTestId('execution-loading')).not.toBeInTheDocument())
    await screen.findByTestId('execution-open-position')

    await user.click(screen.getByRole('button', { name: /^flatten$/i }))
    await user.click(screen.getByRole('button', { name: /flatten positions/i }))

    await waitFor(() =>
      expect(actionSpy).toHaveBeenCalledWith({ action: 'flatten', confirm: true }),
    )
  })

  it('creates a paper account with WO171 decimal string payload', async () => {
    const createSpy = vi.fn()
    server.use(
      http.post('*/api/v1/execution/accounts', async ({ request }) => {
        const body = await request.json()
        createSpy(body)
        return HttpResponse.json({
          id: '99999999-9999-9999-9999-999999999999',
          name: 'Desk Alpha',
          currency: 'BRL',
          initial_balance: '250000.00',
          cash_balance: '250000.00',
          sizing_config: {},
          risk_config: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await screen.findByTestId('execution-workspace')

    await user.click(screen.getByRole('button', { name: /\+ account/i }))
    await user.type(screen.getByLabelText(/name/i), 'Desk Alpha')
    await user.clear(screen.getByLabelText(/initial balance/i))
    await user.type(screen.getByLabelText(/initial balance/i), '250000')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Desk Alpha',
        initial_balance: '250000',
        currency: 'BRL',
      }),
    )
  })

  it('paginates history without rendering more than one page of rows', async () => {
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await waitFor(() => expect(screen.queryByTestId('execution-loading')).not.toBeInTheDocument())
    expect(await screen.findByText(/of 40/)).toBeInTheDocument()

    const historyPanel = screen.getByTestId('execution-history-decisions')
    const rows = historyPanel.querySelectorAll('tbody tr')
    expect(rows.length).toBeLessThanOrEqual(25)
  })

  it('stops execution polling when workspace is inactive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const healthSpy = vi.fn()
    server.use(
      http.get('*/api/v1/execution/health', () => {
        healthSpy()
        return HttpResponse.json({
          api_status: 'ok',
          worker_status: 'healthy',
          market_data_status: 'online',
          kill_switch_enabled: false,
          live_capability_locked: true,
          unknown_order_count: 0,
          deployments: [],
          checked_at: new Date().toISOString(),
        })
      }),
    )

    const { rerender } = renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await waitFor(() => expect(healthSpy).toHaveBeenCalled())
    const callsWhileActive = healthSpy.mock.calls.length

    rerender(<ExecutionWorkspace pollingEnabled={false} />)
    await vi.advanceTimersByTimeAsync(15_000)

    expect(healthSpy.mock.calls.length).toBe(callsWhileActive)
  })
})
