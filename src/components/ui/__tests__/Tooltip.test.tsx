import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip'

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows after the provider delay', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <TooltipProvider delayDuration={350} skipDelayDuration={100}>
        <Tooltip content="Annualized Sharpe ratio">
          <button type="button">Metric</button>
        </Tooltip>
      </TooltipProvider>,
    )

    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument()

    await user.hover(screen.getByRole('button', { name: 'Metric' }))
    vi.advanceTimersByTime(350)

    await waitFor(() => {
      expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(
        'Annualized Sharpe ratio',
      )
    })
  })
})
