import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { DetailZone } from '@/components/market/DetailZone'
import { mockInstrumentInfo, mockSnapshots } from '@/mocks/data'
import { handlers } from '@/mocks/handlers'
import { renderWithQueryClient } from '../../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('InstrumentInfoPanel via DetailZone', () => {
  it('renders instrument fields on the INFO tab', async () => {
    const user = userEvent.setup()
    const snapshot = mockSnapshots.PETR4
    const info = mockInstrumentInfo.PETR4

    renderWithQueryClient(<DetailZone symbol="PETR4" snapshot={snapshot} />)

    await user.click(screen.getByRole('button', { name: 'INFO' }))

    await waitFor(() => {
      expect(screen.getByText(info.description)).toBeInTheDocument()
      expect(screen.getByText(info.exchange)).toBeInTheDocument()
      expect(screen.getByText(`${info.currencyBase} / ${info.currencyProfit}`)).toBeInTheDocument()
      expect(screen.getByText('Floating')).toBeInTheDocument()
    })
  })

  it('shows a quiet empty state when instrument info is missing', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(<DetailZone symbol="UNKNOWN" snapshot={undefined} />)

    await user.click(screen.getByRole('button', { name: 'INFO' }))

    await waitFor(() => {
      expect(screen.getByText('No instrument info available.')).toBeInTheDocument()
    })
  })
})
