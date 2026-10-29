import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StrategyLibrary } from '@/components/backtests/setup/StrategyLibrary'
import { mockStrategyFiles } from '@/mocks/strategyFiles'

describe('StrategyLibrary strategy files', () => {
  it('lists valid files as selectable and invalid files as disabled with their error', async () => {
    const user = userEvent.setup()
    const onSelectStrategyFile = vi.fn()
    render(
      <StrategyLibrary
        strategies={[]}
        engine="candle"
        strategyFiles={mockStrategyFiles.strategy_files}
        onSelectStrategyFile={onSelectStrategyFile}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Strategy files' }))

    const valid = within(screen.getByTestId('strategy-file-card-session_breakout')).getByRole(
      'button',
    )
    expect(valid).toHaveAttribute('aria-disabled', 'false')
    await user.click(valid)
    expect(onSelectStrategyFile).toHaveBeenCalledWith('session_breakout')

    const invalid = within(screen.getByTestId('strategy-file-card-broken_breakout')).getByRole(
      'button',
    )
    expect(invalid).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/No module named talib/)).toBeInTheDocument()
    await user.click(invalid)
    expect(onSelectStrategyFile).toHaveBeenCalledTimes(1)
  })

  it('does not offer strategy files on the tick engine', () => {
    render(
      <StrategyLibrary
        strategies={[]}
        engine="tick"
        strategyFiles={mockStrategyFiles.strategy_files}
      />,
    )

    expect(screen.queryByRole('radio', { name: 'Strategy files' })).not.toBeInTheDocument()
  })
})
