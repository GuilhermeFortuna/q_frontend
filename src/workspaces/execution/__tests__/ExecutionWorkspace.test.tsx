import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { handlers } from '@/mocks/handlers'
import {
  resetMockExecutionState,
  setMockExecutionScenario,
  updateMockKillSwitch,
} from '@/mocks/execution'
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

  it('engages kill switch via slide with exact mutation body and no optimistic Engaged', async () => {
    let releasePut!: () => void
    const putGate = new Promise<void>((resolve) => {
      releasePut = resolve
    })
    const putSpy = vi.fn()
    server.use(
      http.put('*/api/v1/execution/kill-switch', async ({ request }) => {
        const body = (await request.json()) as {
          enabled: boolean
          confirm?: boolean
          reason?: string
          updated_by?: string
        }
        putSpy(body)
        await putGate
        return HttpResponse.json(updateMockKillSwitch(body))
      }),
    )

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 320,
    })
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()

    const user = userEvent.setup()
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await screen.findByTestId('power-off-slide')
    expect(screen.getByTestId('execution-kill-switch-state')).toHaveTextContent(/^Off$/i)

    const thumb = screen.getByRole('slider', { name: /engage global kill switch/i })
    thumb.focus()
    await user.keyboard('{End}{Enter}')

    await waitFor(() => expect(putSpy).toHaveBeenCalledTimes(1))
    expect(putSpy).toHaveBeenCalledWith({
      enabled: true,
      confirm: true,
      reason: 'Operator engaged kill switch from Execution workspace',
      updated_by: 'operator',
    })
    expect(screen.getByTestId('execution-kill-switch-state')).toHaveTextContent(/^Off$/i)
    expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'submitting')
    expect(screen.getByTestId('power-off-slide-status')).toHaveTextContent(/awaiting control plane/i)

    releasePut()
    await waitFor(() =>
      expect(screen.getByTestId('execution-kill-switch-state')).toHaveTextContent(/^Engaged$/i),
    )
    expect(screen.queryByTestId('power-off-slide')).not.toBeInTheDocument()
    expect(screen.getByTestId('execution-kill-switch-release')).toBeInTheDocument()
  })

  it('resets the slide and shows inline error when kill-switch engage is rejected', async () => {
    server.use(
      http.put('*/api/v1/execution/kill-switch', () =>
        HttpResponse.json({ detail: 'kill switch denied' }, { status: 409 }),
      ),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await screen.findByTestId('power-off-slide')

    const thumb = screen.getByRole('slider', { name: /engage global kill switch/i })
    thumb.focus()
    await user.keyboard('{End}{Enter}')

    expect(await screen.findByTestId('execution-action-error')).toHaveTextContent(/kill switch denied/i)
    await waitFor(() =>
      expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'idle'),
    )
    expect(screen.getByTestId('execution-kill-switch-state')).toHaveTextContent(/^Off$/i)
  })

  it('releases kill switch with confirm:false and keeps flatten dialog available', async () => {
    updateMockKillSwitch({
      enabled: true,
      confirm: true,
      reason: 'pre-engaged',
      updated_by: 'operator',
    })

    const putSpy = vi.fn()
    server.use(
      http.put('*/api/v1/execution/kill-switch', async ({ request }) => {
        const body = (await request.json()) as {
          enabled: boolean
          confirm?: boolean
          reason?: string
          updated_by?: string
        }
        putSpy(body)
        return HttpResponse.json(updateMockKillSwitch(body))
      }),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await waitFor(() =>
      expect(screen.getByTestId('execution-kill-switch-state')).toHaveTextContent(/^Engaged$/i),
    )

    await user.click(screen.getByTestId('execution-kill-switch-release'))
    await waitFor(() =>
      expect(putSpy).toHaveBeenCalledWith({
        enabled: false,
        confirm: false,
        updated_by: 'operator',
      }),
    )

    await screen.findByTestId('execution-open-position')
    await user.click(screen.getByRole('button', { name: /^flatten$/i }))
    expect(screen.getByRole('button', { name: /flatten positions/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /engage kill switch/i })).not.toBeInTheDocument()
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

  it('renders the live chart panel with backend indicators for the selected deployment', async () => {
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)
    await waitFor(() => expect(screen.queryByTestId('execution-loading')).not.toBeInTheDocument())

    expect(await screen.findByTestId('execution-live-chart-panel')).toBeInTheDocument()
    expect(await screen.findByTestId('live-strategy-chart')).toBeInTheDocument()
    expect(screen.getByTestId('live-chart-bar-close-note')).toHaveTextContent(/decisions occur at bar close/i)
  })

  it('degrades to a chart-unavailable state against a pre-WO175 backend (404)', async () => {
    server.use(
      http.get('*/api/v1/execution/deployments/:id/chart', () =>
        HttpResponse.json({ detail: 'not found' }, { status: 404 }),
      ),
    )
    renderWithQueryClient(<ExecutionWorkspace pollingEnabled />)

    expect(await screen.findByTestId('live-chart-unavailable')).toBeInTheDocument()
    // Rest of the page still works.
    expect(await screen.findByTestId('execution-retained-position-note')).toBeInTheDocument()
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
