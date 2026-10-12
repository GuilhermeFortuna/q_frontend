import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { IndicatorsModal } from '@/components/charts/IndicatorsModal'
import { handlers } from '@/mocks/handlers'
import { mockIndicatorCatalog } from '@/mocks/marketIndicators'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }

  return render(<IndicatorsModal isOpen indicators={[]} onClose={vi.fn()} onChange={vi.fn()} />, {
    wrapper: Wrapper,
  })
}

describe('IndicatorsModal', () => {
  it('lists every backend catalog entry in the picker', async () => {
    renderModal()

    await waitFor(() => {
      expect(screen.getByTestId('indicator-catalog-item-sma')).toBeInTheDocument()
    })

    for (const entry of mockIndicatorCatalog.indicators) {
      expect(screen.getByTestId(`indicator-catalog-item-${entry.id}`)).toBeInTheDocument()
    }
  })
})
