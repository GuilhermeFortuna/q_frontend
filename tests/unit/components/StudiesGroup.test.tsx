import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { StudiesGroup } from '@/components/charts/StudiesGroup'
import { handlers } from '@/mocks/handlers'
import {
  MOCK_STUDY_HOURLY_ID,
  MOCK_STUDY_KELTNER_ID,
  resetMockResearchStudies,
} from '@/mocks/researchStudies'
import { MARKET_STUDIES_STORAGE_KEY } from '@/lib/market/studySelection'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  window.localStorage.clear()
  resetMockResearchStudies()
})

function renderGroup(symbol: string, timeframe = 'M10') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return {
    ...render(<StudiesGroup symbol={symbol} timeframe={timeframe} />, { wrapper: Wrapper }),
    queryClient,
  }
}

function storedSelections(): Record<string, string[]> {
  return JSON.parse(window.localStorage.getItem(MARKET_STUDIES_STORAGE_KEY) ?? '{}')
}

describe('StudiesGroup', () => {
  it('lists the chart symbol studies and disables one published on another timeframe', async () => {
    renderGroup('WDO$N', 'M10')

    const keltner = await screen.findByTestId(`study-item-${MOCK_STUDY_KELTNER_ID}`)
    expect(within(keltner).getByText('Keltner 20/2')).toBeInTheDocument()
    expect(within(keltner).getByRole('checkbox', { name: 'Draw Keltner 20/2' })).toBeEnabled()

    const hourly = screen.getByTestId(`study-item-${MOCK_STUDY_HOURLY_ID}`)
    expect(within(hourly).getByRole('checkbox', { name: 'Draw Regime score' })).toBeDisabled()
    expect(within(hourly).getByText('Published at H1')).toBeInTheDocument()
  })

  it('lists none after the symbol changes', async () => {
    const { rerender, queryClient } = renderGroup('WDO$N')
    expect(await screen.findByText('Keltner 20/2')).toBeInTheDocument()

    rerender(<StudiesGroup symbol="WDOV26" timeframe="M10" />)
    expect(
      await screen.findByText(
        'No studies published for WDOV26. Publish one with research.publish_study().',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Keltner 20/2')).not.toBeInTheDocument()
    queryClient.clear()
  })

  it('stores the enabled study per symbol', async () => {
    const user = userEvent.setup()
    renderGroup('WDO$N', 'M10')

    await user.click(await screen.findByRole('checkbox', { name: 'Draw Keltner 20/2' }))

    expect(storedSelections()).toEqual({ WDO$N: [MOCK_STUDY_KELTNER_ID] })
    expect(screen.getByRole('checkbox', { name: 'Draw Keltner 20/2' })).toBeChecked()
  })

  it('drops stored ids that no longer name a study', async () => {
    window.localStorage.setItem(
      MARKET_STUDIES_STORAGE_KEY,
      JSON.stringify({ WDO$N: [MOCK_STUDY_KELTNER_ID, 'study_deleted_elsewhere'] }),
    )
    renderGroup('WDO$N', 'M10')

    await screen.findByText('Keltner 20/2')
    await waitFor(() => {
      expect(storedSelections()['WDO$N']).toEqual([MOCK_STUDY_KELTNER_ID])
    })
  })

  it('deletes only after an in-app confirmation', async () => {
    const user = userEvent.setup()
    renderGroup('WDO$N', 'M10')

    await user.click(await screen.findByRole('button', { name: 'Delete Keltner 20/2' }))
    expect(screen.getByText('Delete this study?')).toBeInTheDocument()
    expect(screen.getByText('Keltner 20/2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => {
      expect(screen.queryByText('Keltner 20/2')).not.toBeInTheDocument()
    })
  })
})
