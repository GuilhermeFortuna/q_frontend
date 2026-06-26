import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

describe('SegmentedToggle', () => {
  it('renders single-select with accent-state on the active option', () => {
    const onChange = vi.fn()
    render(
      <SegmentedToggle
        options={[
          { value: 'any', label: 'Any' },
          { value: 'all', label: 'All' },
        ]}
        value="any"
        onChange={onChange}
      />,
    )

    const active = screen.getByRole('radio', { name: 'Any' })
    expect(active).toHaveClass('accent-state')
    fireEvent.click(screen.getByRole('radio', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith('all')
  })

  it('supports multi-select toggling via keyboard-activatable buttons', () => {
    const onToggle = vi.fn()
    render(
      <SegmentedToggle
        mode="multi"
        options={[
          { value: 'ema', label: 'EMA' },
          { value: 'sma', label: 'SMA' },
        ]}
        values={['ema']}
        onToggle={onToggle}
      />,
    )

    const ema = screen.getByRole('button', { name: 'EMA' })
    expect(ema).toHaveClass('accent-state')
    fireEvent.click(screen.getByRole('button', { name: 'SMA' }))
    expect(onToggle).toHaveBeenCalledWith('sma')
  })

  it('moves roving focus with arrow keys in single-select mode', () => {
    render(
      <SegmentedToggle
        options={[
          { value: 'any', label: 'Any' },
          { value: 'all', label: 'All' },
        ]}
        value="any"
        onChange={vi.fn()}
      />,
    )

    const group = screen.getByRole('radiogroup')
    const any = screen.getByRole('radio', { name: 'Any' })
    any.focus()
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus()
  })
})
