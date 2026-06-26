import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import { handlers } from '@/mocks/handlers'
import { resetMockFeatureState } from '@/mocks/features'
import { ResearchWorkspace } from '@/workspaces/research/ResearchWorkspace'
import { renderWithQueryClient } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureState()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('ResearchWorkspace', () => {
  it('renders the three research tabs', async () => {
    renderWithQueryClient(<ResearchWorkspace />)

    expect(screen.getByRole('radio', { name: 'Feature Store' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Feature Scoring' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Feature Lab' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('research-tab-store')).toBeInTheDocument()
    })
  })

  it('renders the feature catalog table on the store tab', async () => {
    renderWithQueryClient(<ResearchWorkspace tab="store" />)

    await waitFor(() => {
      expect(screen.getByTestId('feature-store-table')).toBeInTheDocument()
      expect(screen.getByTestId('feature-store-row-rsi')).toBeInTheDocument()
    })
  })

  it('opens the feature passport when a catalog row is selected', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<ResearchWorkspace tab="store" />)

    await waitFor(() => {
      expect(screen.getByTestId('feature-store-row-rsi')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('feature-store-row-rsi'))

    await waitFor(() => {
      expect(screen.getByTestId('feature-passport')).toBeInTheDocument()
    })
  })

  it('updates the URL search param when switching tabs', () => {
    navigateMock.mockClear()
    renderWithQueryClient(<ResearchWorkspace tab="store" />)

    fireEvent.click(screen.getByRole('radio', { name: 'Feature Scoring' }))
    expect(navigateMock).toHaveBeenCalledWith({ search: { tab: 'scoring' } })

    fireEvent.click(screen.getByRole('radio', { name: 'Feature Lab' }))
    expect(navigateMock).toHaveBeenCalledWith({ search: { tab: 'lab' } })
  })

  it('opens the scoring tab when deep-linked via tab prop', () => {
    renderWithQueryClient(<ResearchWorkspace tab="scoring" />)

    expect(screen.getByTestId('research-tab-scoring')).toBeInTheDocument()
    expect(screen.queryByTestId('research-tab-store')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Feature Scoring' })).toHaveClass('accent-state')
  })
})
