import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EntryManagerSelector } from '@/components/backtests/setup/EntryManagerSelector'
import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import { mockSignalManagers } from '@/mocks/data'
import type { StrategyInfo } from '@/types/strategies'

const sampleStrategies: StrategyInfo[] = [
  {
    name: 'ma_crossover',
    label: 'MA Crossover',
    description: 'Classic crossover',
    params: [{ name: 'fast', label: 'Fast', type: 'int', default: 10 }],
    engine: 'candle',
    category: 'trend',
  },
  {
    name: 'rsi_reversion',
    label: 'RSI Reversion',
    description: 'Mean reversion',
    params: [],
    engine: 'candle',
    category: 'mean_reversion',
  },
]

describe('backtests WO118 primitive migration', () => {
  it('renders strategy library with FilterPills and EntityCard-backed tiles', async () => {
    const user = userEvent.setup()
    const onSelectBuiltIn = vi.fn()

    render(
      <StrategyLibrary
        strategies={sampleStrategies}
        engine="candle"
        selectedStrategyName="ma_crossover"
        onSelectBuiltIn={onSelectBuiltIn}
      />,
    )

    expect(
      screen.getByRole('radiogroup', { name: 'Entry strategy categories' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /MA Crossover/i })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Mean reversion' }))
    await user.click(screen.getByRole('button', { name: /RSI Reversion/i }))
    expect(onSelectBuiltIn).toHaveBeenCalledWith('rsi_reversion')
  })

  it('updates manager state through SegmentedToggle radios', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <EntryManagerSelector
        managers={mockSignalManagers.managers}
        value={{ kind: 'or', params: {} }}
        onChange={onChange}
        instanceCount={2}
        showParams={false}
      />,
    )

    const group = screen.getByRole('radiogroup', { name: 'Entry manager' })
    expect(within(group).getByRole('radio', { name: 'Any (OR)' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await user.click(within(group).getByRole('radio', { name: 'All (AND)' }))
    expect(onChange).toHaveBeenCalledWith({ kind: 'and', params: {} })
  })
})
