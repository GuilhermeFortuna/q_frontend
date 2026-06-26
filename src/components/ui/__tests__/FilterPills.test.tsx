import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FilterPills } from '@/components/ui/FilterPills'

describe('FilterPills', () => {
  it('renders active pill with accent-state and supports All option', () => {
    const onChange = vi.fn()
    render(
      <FilterPills
        options={[
          { value: 'all', label: 'All' },
          { value: 'trend', label: 'Trend' },
        ]}
        value="trend"
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Trend' })).toHaveClass('accent-state')
    fireEvent.click(screen.getByRole('radio', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith('all')
  })
})
