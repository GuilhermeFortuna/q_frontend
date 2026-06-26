import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EntityCard } from '@/components/ui/EntityCard'

describe('EntityCard', () => {
  it('renders selected state with accent-state and activates from keyboard', () => {
    const onSelect = vi.fn()
    render(
      <EntityCard
        title="Dual MA"
        tag="Trend"
        description="Crossover strategy"
        meta="4 params"
        selected
        onSelect={onSelect}
      />,
    )

    const card = screen.getByRole('button', { name: /Dual MA/i })
    expect(card).toHaveClass('accent-state')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
