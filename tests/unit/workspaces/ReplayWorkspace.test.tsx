import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { handlers } from '@/mocks/handlers'
import { resetMockReplayState } from '@/mocks/replay'
import { ReplayWorkspace } from '@/workspaces/replay/ReplayWorkspace'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockReplayState()
})
afterAll(() => server.close())

const RUN = {
  run_id: '0b8f1f0e-6a7e-4d59-9a4b-3f1c2a7e9d10',
  generation: 'gen-test',
  state: 'paused',
  revision: 2,
  rate: 1,
  canonical_cursor_utc: '2026-10-01T12:00:00Z',
  visible_cursor_utc: '2026-10-01T11:59:59Z',
  queue_depth: 0,
  lag_ms: 0,
  outstanding_intents: 0,
  config_hash: `sha256:${'a'.repeat(64)}`,
  dataset_checksums: [`sha256:${'b'.repeat(64)}`],
  last_error: null,
}

function overviewWith(state: string, revision = 2) {
  return http.get('*/api/v1/replay/overview', () =>
    HttpResponse.json({
      phase: 'ready',
      run: { ...RUN, state, revision },
      terminal_running: false,
      last_error: null,
    }),
  )
}

const emptyJournal = http.get('*/api/v1/replay/runs/current/journal', () =>
  HttpResponse.json({ entries: [], next_after_seq: null }),
)

describe('ReplayWorkspace', () => {
  it('shows an unavailable notice when the Research API has no replay routes', async () => {
    server.use(http.get('*/api/v1/replay/overview', () => new HttpResponse(null, { status: 404 })))
    renderWithQueryClient(<ReplayWorkspace />)
    expect(await screen.findByText('Replay control is not available')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start replay stack/i })).not.toBeInTheDocument()
  })

  it('an idle stack offers the simple start form only', async () => {
    renderWithQueryClient(<ReplayWorkspace />)
    expect(await screen.findByRole('button', { name: 'Start replay' })).toBeInTheDocument()
    expect(screen.getByLabelText('Symbol')).toBeInTheDocument()
    expect(screen.getByLabelText('First day')).toBeInTheDocument()
    expect(screen.getByLabelText('Last day')).toBeInTheDocument()
    expect(screen.getByLabelText('Initial capital (BRL)')).toBeInTheDocument()
    expect(screen.getByLabelText(/Point value/)).toBeInTheDocument()
    expect(screen.queryByText(/Freeze a new dataset/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/latency/i)).not.toBeInTheDocument()
  })

  it('lets the operator type the initial capital and point value', async () => {
    renderWithQueryClient(<ReplayWorkspace />)
    const user = userEvent.setup()
    const capital = await screen.findByLabelText('Initial capital (BRL)')
    await user.clear(capital)
    await user.type(capital, '25000.00')
    expect(capital).toHaveValue('25000.00')
    const point = screen.getByLabelText(/Point value/)
    await user.type(point, '0.20')
    expect(point).toHaveValue('0.20')
  })

  it('a paused run enables step and resume, and not pause', async () => {
    server.use(overviewWith('paused'), emptyJournal)
    renderWithQueryClient(<ReplayWorkspace />)
    const resume = await screen.findByRole('button', { name: 'Resume' })
    await waitFor(() => expect(resume).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled()
  })

  it('a running run enables pause and disables step', async () => {
    server.use(overviewWith('running', 4), emptyJournal)
    renderWithQueryClient(<ReplayWorkspace />)
    const pause = await screen.findByRole('button', { name: 'Pause' })
    await waitFor(() => expect(pause).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Step' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled()
  })

  it('a stale revision refusal is reported and the status is not retried', async () => {
    let commands = 0
    server.use(
      overviewWith('paused', 2),
      emptyJournal,
      http.post('*/api/v1/replay/runs/current/commands', () => {
        commands += 1
        return HttpResponse.json({
          command_id: '00000000-0000-4000-8000-000000000000',
          accepted: false,
          reason: 'stale_revision',
          revision: 3,
          state: 'running',
        })
      }),
    )
    renderWithQueryClient(<ReplayWorkspace />)
    const resume = await screen.findByRole('button', { name: 'Resume' })
    await waitFor(() => expect(resume).toBeEnabled())
    const user = userEvent.setup()
    await user.click(resume)
    const status = await screen.findByRole('status')
    expect(
      within(status).getByText(/The run changed since this view was loaded/),
    ).toBeInTheDocument()
    expect(commands).toBe(1)
  })

  it('end run and shutdown ask for a second click before they act', async () => {
    let stops = 0
    server.use(
      overviewWith('paused', 2),
      emptyJournal,
      http.post('*/api/v1/replay/stack/stop', () => {
        stops += 1
        return HttpResponse.json(
          { phase: 'stopping', run: null, terminal_running: false, last_error: null },
          { status: 202 },
        )
      }),
    )
    renderWithQueryClient(<ReplayWorkspace />)
    const user = userEvent.setup()
    const shutdown = await screen.findByRole('button', { name: 'Shut down stack' })
    await waitFor(() => expect(shutdown).toBeEnabled())
    await user.click(shutdown)
    expect(stops).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Confirm shut down stack' }))
    await waitFor(() => expect(stops).toBe(1))
  })
})

describe('ReplayWorkspace start form memory', () => {
  it('shows the last values typed when the page is opened again', async () => {
    window.localStorage.clear()
    const first = renderWithQueryClient(<ReplayWorkspace />)
    const user = userEvent.setup()
    const capital = await screen.findByLabelText('Initial capital (BRL)')
    await user.clear(capital)
    await user.type(capital, '31000.00')
    first.unmount()

    renderWithQueryClient(<ReplayWorkspace />)
    expect(await screen.findByLabelText('Initial capital (BRL)')).toHaveValue('31000.00')
  })
})
