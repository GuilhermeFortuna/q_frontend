import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RangeInput } from '@/components/ui/RangeInput'

describe('RangeInput', () => {
  it('emits min/max/step changes and surfaces custom error', () => {
    const onChange = vi.fn()
    render(
      <RangeInput min={10} max={50} step={5} onChange={onChange} error="Invalid search space." />,
    )

    expect(screen.getByText('Invalid search space.')).toHaveClass('text-rose-400')
    fireEvent.change(screen.getByLabelText('Minimum'), { target: { value: '12' } })
    expect(onChange).toHaveBeenCalledWith({ min: 12, max: 50, step: 5 })
  })

  it('shows built-in range validation when min exceeds max', () => {
    render(<RangeInput min={80} max={20} step={null} onChange={vi.fn()} />)
    expect(screen.getByText('Min must be ≤ max.')).toBeInTheDocument()
  })

  it('keeps Min/Max/Step captions visible when values are filled', () => {
    render(<RangeInput min={10} max={50} step={5} onChange={vi.fn()} />)

    expect(screen.getByText('Min')).toBeInTheDocument()
    expect(screen.getByText('Max')).toBeInTheDocument()
    expect(screen.getByText('Step')).toBeInTheDocument()
    expect(screen.getByLabelText('Minimum')).toHaveValue(10)
    expect(screen.getByLabelText('Maximum')).toHaveValue(50)
    expect(screen.getByLabelText('Step')).toHaveValue(5)
  })

  it('supports custom caption labels', () => {
    render(
      <RangeInput
        min={1}
        max={9}
        step={1}
        onChange={vi.fn()}
        labels={{ min: 'Low', max: 'High', step: 'Stride' }}
      />,
    )

    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Stride')).toBeInTheDocument()
    expect(screen.getByLabelText('Low')).toHaveValue(1)
  })
})
