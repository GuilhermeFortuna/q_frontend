import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { handlers, resetMockStorageDeletes } from '@/mocks/handlers'
import { mockDataSource, mockStorageInventory, resetMockStorageState } from '@/mocks/storage'
import { StorageWorkspace } from '@/workspaces/storage/StorageWorkspace'
import { SystemWorkspace } from '@/workspaces/system/SystemWorkspace'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockStorageDeletes()
  resetMockStorageState()
})
afterAll(() => server.close())

describe('StorageWorkspace', () => {
  it('renders inventory rows from MSW', async () => {
    renderWithQueryClient(<StorageWorkspace />)

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    const table = screen.getByRole('table')
    expect(within(table).getByText('PETR4')).toBeInTheDocument()
    expect(within(table).getByText('VALE3')).toBeInTheDocument()
    expect(within(table).getByText('WIN$')).toBeInTheDocument()
  })

  it('renders kind badges and shows no timeframe for tick rows', async () => {
    renderWithQueryClient(<StorageWorkspace />)

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    const table = screen.getByRole('table')
    expect(within(table).getAllByText('Bars')).toHaveLength(2)
    expect(within(table).getByText('Ticks')).toBeInTheDocument()

    const tickRow = within(table).getByText('WIN$').closest('tr')
    expect(tickRow).not.toBeNull()
    expect(within(tickRow as HTMLElement).getByText('—')).toBeInTheDocument()
  })

  it('disables download when MT5 is unavailable', async () => {
    renderWithQueryClient(<StorageWorkspace />)

    await waitFor(() => {
      expect(
        screen.getByText(/Downloading needs MT5 — run this on the Windows machine/i),
      ).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
  })

  it('hides timeframe control and submits kind ticks when Ticks is selected', async () => {
    mockDataSource.mt5_available = true
    let ingestBody: Record<string, unknown> | null = null

    server.use(
      http.post('*/api/v1/storage/ingest', async ({ request }) => {
        ingestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ job_id: 'ingest-ticks-job', status: 'queued' })
      }),
      http.get('*/api/v1/storage/ingest/:jobId', () =>
        HttpResponse.json({
          job_id: 'ingest-ticks-job',
          status: 'completed',
          progress: 1,
          detail: 'Tick ingestion completed for PETR4',
          results: [{ timeframe: '2024-03', rows: 120_000, status: 'completed', error: null }],
          error: null,
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<StorageWorkspace />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())

    expect(screen.getByText('Timeframes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ticks' }))
    expect(screen.queryByText('Timeframes')).not.toBeInTheDocument()
    expect(screen.getByText(/Tick ranges are very large and ingest slowly/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => {
      expect(ingestBody).not.toBeNull()
    })
    expect(ingestBody).toMatchObject({
      symbol: 'PETR4',
      kind: 'ticks',
      timeframes: [],
    })
  })

  it('navigates symbol suggestions with arrow keys and selects with Enter', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StorageWorkspace />)

    const symbolInput = screen.getByLabelText('Symbol')
    await user.clear(symbolInput)
    await user.type(symbolInput, 'PET')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(screen.getAllByRole('option')).toHaveLength(2)
    })

    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() => {
      expect(symbolInput).toHaveValue('PETR3')
    })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows MT5 available range and applies full range to date inputs', async () => {
    mockDataSource.mt5_available = true
    const end = new Date('2026-06-07T12:00:00')
    const start = new Date('2020-01-01T12:00:00')

    server.use(
      http.get('*/api/v1/market/ohlcv/:symbol/available-range', () =>
        HttpResponse.json({
          symbol: 'PETR4',
          timeframe: 'D1',
          start: start.toISOString(),
          end: end.toISOString(),
          bar_count: 1500,
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<StorageWorkspace />)

    await waitFor(() => {
      expect(screen.getByText(/Available in MT5 for/i)).toBeInTheDocument()
      expect(screen.getByText(/1,500 bars/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Use full range' }))

    const startInput = screen.getByLabelText('Start') as HTMLInputElement
    const endInput = screen.getByLabelText('End') as HTMLInputElement
    expect(startInput.value).toBe('2020-01-01')
    expect(endInput.value).toBe('2026-06-07')
  })

  it('deletes a bar inventory row', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )

    renderWithQueryClient(<StorageWorkspace />)
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getByText('VALE3')).toBeInTheDocument(),
    )

    const row = within(screen.getByRole('table')).getByText('VALE3').closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(within(screen.getByRole('table')).queryByText('VALE3')).not.toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('deletes a tick dataset via the ticks delete endpoint', async () => {
    const user = userEvent.setup()
    let deletePath: string | null = null
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )

    server.use(
      http.delete('*/api/v1/storage/:symbol/:timeframe', ({ params, request }) => {
        deletePath = new URL(request.url).pathname
        const symbol = String(params.symbol).toUpperCase()
        const kept = mockStorageInventory.filter(
          (item) => !(item.symbol === symbol && item.kind === 'ticks'),
        )
        mockStorageInventory.splice(0, mockStorageInventory.length, ...kept)
        return HttpResponse.json({ deleted: true, symbol, timeframe: 'ticks' })
      }),
    )

    renderWithQueryClient(<StorageWorkspace />)
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getByText('WIN$')).toBeInTheDocument(),
    )

    const row = within(screen.getByRole('table')).getByText('WIN$').closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(deletePath).toMatch(/\/api\/v1\/storage\/WIN%24\/ticks$/)
      expect(within(screen.getByRole('table')).queryByText('WIN$')).not.toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('runs a mocked bar ingest job and refreshes inventory', async () => {
    mockDataSource.mt5_available = true
    mockStorageInventory.splice(0, mockStorageInventory.length)

    server.use(
      http.post('*/api/v1/storage/ingest', async ({ request }) => {
        const body = (await request.json()) as {
          symbol: string
          timeframes: string[]
        }
        const symbol = body.symbol.toUpperCase()
        for (const timeframe of body.timeframes) {
          mockStorageInventory.push({
            symbol,
            kind: 'bars',
            timeframe,
            start: '2024-01-01T00:00:00',
            end: '2024-06-01T00:00:00',
            rows: 120,
            bytes: 16_384,
            updated_at: new Date().toISOString(),
          })
        }
        return HttpResponse.json({ job_id: 'ingest-test-job', status: 'queued' })
      }),
      http.get('*/api/v1/storage/ingest/:jobId', () =>
        HttpResponse.json({
          job_id: 'ingest-test-job',
          status: 'completed',
          progress: 1,
          detail: 'Ingestion completed for PETR4',
          results: [{ timeframe: 'D1', rows: 120, status: 'completed', error: null }],
          error: null,
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<StorageWorkspace />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => {
      expect(screen.getByText(/Ingestion completed/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(within(screen.getByRole('table')).getByText('PETR4')).toBeInTheDocument()
    })
  })
})

describe('SystemWorkspace data source card', () => {
  it('reflects mocked data source and switches via PUT', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<SystemWorkspace />)

    await waitFor(() => {
      expect(screen.getByText('Data Source')).toBeInTheDocument()
      expect(screen.getByText('no')).toBeInTheDocument()
      expect(screen.getByText('local')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Local' }))

    await waitFor(() => {
      expect(mockDataSource.source).toBe('local')
    })
  })
})
