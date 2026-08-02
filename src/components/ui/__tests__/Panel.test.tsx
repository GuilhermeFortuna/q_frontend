import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Panel, PanelHeader } from '@/components/ui/Panel'

describe('Panel', () => {
  it('renders with GlowCard panel intensity', () => {
    const { container } = render(
      <Panel>
        <PanelHeader title="Costs" right="2 fields" />
      </Panel>,
    )

    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('data-glow', 'panel')
    expect(screen.getByText('Costs')).toHaveClass('accent-wayfinding')
    expect(screen.getByText('2 fields')).toBeInTheDocument()
  })

  it('keeps living prop API without stacking surface-panel--living', () => {
    const { container } = render(<Panel living>Content</Panel>)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('data-glow', 'panel')
    expect(root).not.toHaveClass('surface-panel--living')
  })
})
