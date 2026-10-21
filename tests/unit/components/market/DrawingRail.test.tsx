import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DrawingRail, type DrawingRailProps } from '@/components/market/DrawingRail'

function renderRail(overrides: Partial<DrawingRailProps> = {}) {
  const props: DrawingRailProps = {
    activeDrawingTool: 'cursor',
    onActiveDrawingToolChange: vi.fn(),
    onClearDrawings: vi.fn(),
    magnet: false,
    onMagnetChange: vi.fn(),
    keepDrawing: false,
    onKeepDrawingChange: vi.fn(),
    hideAll: false,
    onHideAllChange: vi.fn(),
    ...overrides,
  }
  render(<DrawingRail {...props} />)
  return props
}

describe('DrawingRail', () => {
  it("arms a group's last-used tool and remembers the tool picked from its flyout", async () => {
    const user = userEvent.setup()
    const props = renderRail()

    expect(screen.getByText('Draw')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lines: Trend line' }))
    expect(props.onActiveDrawingToolChange).toHaveBeenLastCalledWith('trendline')

    await user.click(screen.getByRole('button', { name: 'More lines tools' }))
    const flyout = screen.getByRole('menu', { name: 'Lines tools' })
    await user.click(within(flyout).getByRole('menuitem', { name: 'Horizontal line' }))
    expect(props.onActiveDrawingToolChange).toHaveBeenLastCalledWith('hline')
    expect(screen.getByRole('button', { name: 'Lines: Horizontal line' })).toBeInTheDocument()
  })

  it('confirms before clearing every drawing', async () => {
    const user = userEvent.setup()
    const props = renderRail()

    await user.click(screen.getByRole('button', { name: 'Clear all drawings' }))
    expect(props.onClearDrawings).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(props.onClearDrawings).toHaveBeenCalledTimes(1)
  })

  it('reports the Magnet, Keep drawing and Hide all toggles', async () => {
    const user = userEvent.setup()
    const props = renderRail({ magnet: false })

    await user.click(screen.getByRole('button', { name: 'Magnet' }))
    expect(props.onMagnetChange).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: 'Keep drawing' }))
    expect(props.onKeepDrawingChange).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: 'Hide all drawings' }))
    expect(props.onHideAllChange).toHaveBeenCalledWith(true)
  })
})
