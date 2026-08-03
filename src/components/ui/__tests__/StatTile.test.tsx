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

  it('preserves legacy string value byte-for-byte when animateValue is off', () => {
    render(<StatTile label="Open" value="1,234.50" numericValue={1234.5} />)
    expect(screen.getByText('1,234.50')).toBeInTheDocument()
    expect(screen.queryByLabelText('1,234.50')).not.toBeInTheDocument()
  })

  it('does not animate when numeric props are absent even if animateValue is true', () => {
    render(<StatTile label="Static" value="42%" animateValue />)
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(document.querySelector('[data-quant-number-flow]')).toBeNull()
  })

  it('opts into QuantNumberFlow when animateValue and numeric props are provided', () => {
    render(
      <StatTile
        label="CPU Core Load"
        value="24%"
        numericValue={24}
        formatNumericValue={(v) => `${v}%`}
        animateValue
      />,
    )

    const flow = document.querySelector('[data-quant-number-flow]') as HTMLElement
    expect(flow).toBeTruthy()
    expect(flow).toHaveAttribute('aria-label', '24%')
    expect(flow).toHaveAttribute('data-value', '24')
    expect(screen.getByText('CPU Core Load')).toBeInTheDocument()
  })
})
