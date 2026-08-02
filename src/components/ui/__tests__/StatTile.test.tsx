import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatTile } from '@/components/ui/StatTile'

describe('StatTile', () => {
  it('renders on a quiet glow tile with non-gold delta tones', () => {
    const { container } = render(
      <StatTile label="Net profit" value="+12.4%" delta="+2.1%" deltaTone="up" />,
    )

    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('data-glow', 'tile')
    expect(root).not.toHaveClass('surface-card', 'surface-card--edge')
    expect(screen.getByText('+2.1%')).toHaveClass('text-emerald-400')
  })
})
