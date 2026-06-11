import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DrawingRail } from '@/components/market/DrawingRail'

describe('DrawingRail', () => {
  it('renders drawing tools and updates the active tool', async () => {
    const user = userEvent.setup()
    const onActiveDrawingToolChange = vi.fn()

    render(
      <DrawingRail
        activeDrawingTool="cursor"
        onActiveDrawingToolChange={onActiveDrawingToolChange}
        onClearDrawings={vi.fn()}
      />,
    )

    expect(screen.getByText('Draw')).toBeInTheDocument()

    await user.click(screen.getByTitle('Draw Trendline'))
    expect(onActiveDrawingToolChange).toHaveBeenCalledWith('trendline')
  })
})
