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

  it('deletes an inventory row', async () => {
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

  it('runs a mocked ingest job and refreshes inventory', async () => {
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

    resetMockStorageState()
    mockDataSource.mt5_available = false
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
