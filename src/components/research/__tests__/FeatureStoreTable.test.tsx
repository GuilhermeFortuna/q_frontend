import { setupServer } from 'msw/node'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FeatureStorePanel, FeatureStoreTable } from '@/components/research/FeatureStoreTable'
import { handlers } from '@/mocks/handlers'
import { mockFeatureList, resetMockFeatureState } from '@/mocks/features'
import { renderWithQueryClient } from '../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockFeatureState()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('FeatureStoreTable', () => {
  it('renders one row per feature with all six columns and shows — for null scores', () => {
    const onSelectFeature = vi.fn()

    renderWithQueryClient(
      <FeatureStoreTable features={mockFeatureList} onSelectFeature={onSelectFeature} />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(mockFeatureList.length + 1)

    const donchianRow = within(table).getByTestId('feature-store-row-donchian_upper')
    expect(within(donchianRow).getByText('donchian_upper')).toBeInTheDocument()
    expect(within(donchianRow).getByText('Trend')).toBeInTheDocument()
    expect(within(donchianRow).getByText('v1')).toBeInTheDocument()
    expect(within(donchianRow).getByText('experimental')).toBeInTheDocument()
    expect(within(donchianRow).getByText('1')).toBeInTheDocument()
    expect(within(donchianRow).getByText('—')).toBeInTheDocument()
  })

  it('sorts by score descending with null scores last', () => {
    const onSelectFeature = vi.fn()

    renderWithQueryClient(
      <FeatureStoreTable features={mockFeatureList} onSelectFeature={onSelectFeature} />,
    )

    const rows = screen.getAllByRole('row').slice(1)
    const names = rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent?.trim())
    expect(names[0]).toBe('rsi')
    expect(names.at(-1)).toBe('donchian_upper')
  })

  it('reorders rows when sorting by usage', async () => {
    const user = userEvent.setup()
    const onSelectFeature = vi.fn()

    renderWithQueryClient(
      <FeatureStoreTable features={mockFeatureList} onSelectFeature={onSelectFeature} />,
    )

    await user.click(screen.getByRole('button', { name: 'Sort by Usage' }))

    const rows = screen.getAllByRole('row').slice(1)
    const usageValues = rows.map((row) => Number(within(row).getAllByRole('cell')[4]?.textContent))
    expect(usageValues).toEqual([...usageValues].sort((left, right) => right - left))
  })

  it('fires onSelectFeature when a row is clicked', () => {
    const onSelectFeature = vi.fn()

    renderWithQueryClient(
      <FeatureStoreTable features={mockFeatureList} onSelectFeature={onSelectFeature} />,
    )

    fireEvent.click(screen.getByTestId('feature-store-row-rsi'))
    expect(onSelectFeature).toHaveBeenCalledWith('rsi')
  })
})

describe('FeatureStorePanel', () => {
  it('refetches with category query param when a category pill is selected', async () => {
    const user = userEvent.setup()
    const onSelectFeature = vi.fn()

    renderWithQueryClient(<FeatureStorePanel onSelectFeature={onSelectFeature} />)

    await waitFor(() => {
      expect(screen.getByTestId('feature-store-row-rsi')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('radio', { name: 'Momentum' }))

    await waitFor(() => {
      expect(screen.queryByTestId('feature-store-row-ma')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('feature-store-row-rsi')).toBeInTheDocument()
    expect(screen.getByTestId('feature-store-row-macd')).toBeInTheDocument()
  })

  it('fires onSelectFeature from the catalog panel', async () => {
    const onSelectFeature = vi.fn()

    renderWithQueryClient(<FeatureStorePanel onSelectFeature={onSelectFeature} />)

    await waitFor(() => {
      expect(screen.getByTestId('feature-store-row-ma')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('feature-store-row-ma'))
    expect(onSelectFeature).toHaveBeenCalledWith('ma')
  })
})
