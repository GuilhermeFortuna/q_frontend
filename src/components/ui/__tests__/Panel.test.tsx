import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Panel, PanelHeader } from '@/components/ui/Panel'

describe('Panel', () => {
  it('renders with surface-panel material class', () => {
    const { container } = render(
      <Panel>
        <PanelHeader title="Costs" right="2 fields" />
      </Panel>,
    )

    expect(container.firstChild).toHaveClass('surface-panel')
    expect(screen.getByText('Costs')).toHaveClass('accent-wayfinding')
    expect(screen.getByText('2 fields')).toBeInTheDocument()
  })

  it('adds living modifier when requested', () => {
    const { container } = render(<Panel living>Content</Panel>)
    expect(container.firstChild).toHaveClass('surface-panel--living')
  })
})
