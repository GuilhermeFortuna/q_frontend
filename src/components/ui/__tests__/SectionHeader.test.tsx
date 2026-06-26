import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SectionHeader } from '@/components/ui/SectionHeader'

describe('SectionHeader', () => {
  it('renders a tier-1 wayfinding label', () => {
    render(<SectionHeader title="Instrument & Modeling" right="count: 4" />)

    expect(screen.getByText('Instrument & Modeling')).toHaveClass('accent-wayfinding')
    expect(screen.getByText('count: 4')).toBeInTheDocument()
  })
})
