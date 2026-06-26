import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LabeledField } from '@/components/ui/LabeledField'

describe('LabeledField', () => {
  it('renders label, hint, and error', () => {
    render(
      <LabeledField label="Fast period" hint="Must be positive." error="Out of range.">
        <input aria-label="Fast period" />
      </LabeledField>,
    )

    expect(screen.getByText('Fast period')).toHaveClass('accent-wayfinding')
    expect(screen.getByText('Must be positive.')).toBeInTheDocument()
    expect(screen.getByText('Out of range.')).toHaveClass('text-rose-400')
  })
})
