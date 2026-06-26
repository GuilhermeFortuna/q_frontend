import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RangeChips } from '@/components/ui/RangeChips'

describe('RangeChips', () => {
  it('renders selected chip with accent-state and activates via keyboard', () => {
    const onSelect = vi.fn()
    render(
      <RangeChips
        options={[
          { value: '1M', label: '1M' },
          { value: '3M', label: '3M' },
        ]}
        value="3M"
        onSelect={onSelect}
      />,
    )

    const selected = screen.getByRole('radio', { name: '3M' })
    expect(selected).toHaveClass('accent-state')
    const chip = screen.getByRole('radio', { name: '1M' })
    fireEvent.keyDown(chip, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('1M')
  })
})
