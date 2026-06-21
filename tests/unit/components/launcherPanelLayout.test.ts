import { describe, expect, it } from 'vitest'

import {
  clampPanelLayout,
  getDefaultPanelLayouts,
  getLauncherDockClearance,
  getLauncherPanelBounds,
  normalizePanelLayout,
  panelLayoutNeedsRecovery,
} from '@/components/launcher/launcherPanelLayout'

describe('launcherPanelLayout', () => {
  it('reserves clearance above the launcher dock', () => {
    const bounds = getLauncherPanelBounds({ width: 1200, height: 800 })

    expect(getLauncherDockClearance(800)).toBeGreaterThanOrEqual(120)
    expect(bounds.height).toBeLessThan(800)
    expect(bounds.width).toBe(1200)
  })

  it('keeps default panels above the dock safe area on a typical viewport', () => {
    const container = { width: 1200, height: 800 }
    const bounds = getLauncherPanelBounds(container)
    const defaults = getDefaultPanelLayouts(bounds.width, bounds.height)

    expect(defaults.system.y + defaults.system.height).toBeLessThanOrEqual(bounds.height)
    expect(defaults.market.y + defaults.market.height).toBeLessThanOrEqual(bounds.height)
  })

  it('recovers oversized panels that block vertical movement', () => {
    const bounds = getLauncherPanelBounds({ width: 1200, height: 800 })
    const defaults = getDefaultPanelLayouts(bounds.width, bounds.height)
    const oversized = {
      x: bounds.width - 360,
      y: 0,
      width: 360,
      height: bounds.height + 120,
    }

    expect(panelLayoutNeedsRecovery(oversized, bounds, defaults.system)).toBe(true)

    const recovered = normalizePanelLayout(oversized, bounds, defaults.system)

    expect(recovered.height).toBeLessThan(bounds.height)
    expect(recovered.y).toBe(defaults.system.y)
    expect(recovered.y + recovered.height).toBeLessThanOrEqual(bounds.height)
  })

  it('allows dragging upward after clamping inside strict bounds', () => {
    const bounds = getLauncherPanelBounds({ width: 1000, height: 700 })
    const defaults = getDefaultPanelLayouts(bounds.width, bounds.height)
    const stuck = {
      x: bounds.width - 360,
      y: bounds.height - defaults.system.height,
      width: 360,
      height: defaults.system.height,
    }

    const draggedUp = clampPanelLayout({ ...stuck, y: stuck.y - 80 }, bounds)

    expect(draggedUp.y).toBeLessThan(stuck.y)
    expect(draggedUp.y + draggedUp.height).toBeLessThanOrEqual(bounds.height)
  })

  it('clamps drag targets inside the dock-safe bounds', () => {
    const bounds = getLauncherPanelBounds({ width: 1000, height: 700 })
    const clamped = clampPanelLayout({ x: 0, y: 900, width: 360, height: 420 }, bounds)

    expect(clamped.y + clamped.height).toBeLessThanOrEqual(bounds.height)
  })
})
