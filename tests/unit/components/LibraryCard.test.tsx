import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { LibraryCard } from '@/components/backtests/setup/LibraryCard'

describe('LibraryCard', () => {
  it('renders title, tag, description, and param count', () => {
    render(
      <LibraryCard
        title="MA Crossover"
        tag="Trend"
        description="Classic moving-average crossover."
        paramCount={3}
        selected={false}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /MA Crossover/i })).toBeInTheDocument()
    expect(screen.getByText('Trend')).toBeInTheDocument()
    expect(screen.getByText('Classic moving-average crossover.')).toBeInTheDocument()
    expect(screen.getByText('3 params')).toBeInTheDocument()
  })

  it('fires onClick when the card is pressed', () => {
    const onClick = vi.fn()
    render(
      <LibraryCard
        title="ATR Stop"
        tag="Stop Loss"
        description="ATR-based stop."
        paramCount={2}
        selected={false}
        onClick={onClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /ATR Stop/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the trailing slot', () => {
    render(
      <LibraryCard
        title="Saved Strategy"
        description="A saved custom strategy."
        selected={false}
        onClick={vi.fn()}
        trailing={<span data-testid="trailing-slot">Delete</span>}
      />,
    )

    expect(screen.getByTestId('trailing-slot')).toBeInTheDocument()
  })
})
