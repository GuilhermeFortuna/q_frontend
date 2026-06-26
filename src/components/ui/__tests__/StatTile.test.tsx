import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatTile } from '@/components/ui/StatTile'

describe('StatTile', () => {
  it('renders on a raised surface-card with non-gold delta tones', () => {
    const { container } = render(
      <StatTile label="Net profit" value="+12.4%" delta="+2.1%" deltaTone="up" />,
    )

    expect(container.firstChild).toHaveClass('surface-card', 'surface-card--edge')
    expect(screen.getByText('+2.1%')).toHaveClass('text-emerald-400')
  })
})
