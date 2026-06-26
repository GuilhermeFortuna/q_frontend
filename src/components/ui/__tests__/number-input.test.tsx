import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { NumberInput } from '@/components/ui/number-input'

describe('NumberInput', () => {
  it('does not render stepper buttons by default', () => {
    render(<NumberInput value={5} onChange={vi.fn()} aria-label="Amount" />)
    expect(screen.queryByRole('button', { name: 'Increment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Decrement' })).not.toBeInTheDocument()
  })

  it('increments and decrements by step when showSteppers is enabled', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [value, setValue] = useState(10)
      return (
        <NumberInput
          value={value}
          min={0}
          step={2}
          integer
          showSteppers
          onChange={setValue}
          aria-label="Period"
        />
      )
    }

    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByLabelText('Period')).toHaveValue(12)

    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(screen.getByLabelText('Period')).toHaveValue(10)
  })

  it('clamps decrements to min and rounds integers', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <NumberInput
        value={1}
        min={0}
        step={1}
        integer
        showSteppers
        onChange={onChange}
        aria-label="Period"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})
