import type { LauncherPanelLayout, LauncherPanelLayouts } from '@/store/slices/jobSessionsSlice'

export const PANEL_MIN_WIDTH = 320
export const PANEL_MIN_HEIGHT = 360
export const PANEL_DEFAULT_WIDTH = 360
export const PANEL_DEFAULT_HEIGHT_RATIO = 0.72
/** Keeps floating panels above the launcher dock (`bottom-[12%]` + chrome). */
export const LAUNCHER_DOCK_CLEARANCE_MIN = 120

export type ContainerRect = {
  width: number
  height: number
}

export function getLauncherDockClearance(containerHeight: number): number {
  if (containerHeight <= 0) return LAUNCHER_DOCK_CLEARANCE_MIN
  return Math.max(LAUNCHER_DOCK_CLEARANCE_MIN, Math.round(containerHeight * 0.12) + 72)
}

export function getLauncherPanelBounds(container: ContainerRect): ContainerRect {
  const clearance = getLauncherDockClearance(container.height)
  return {
    width: container.width,
    height: Math.max(PANEL_MIN_HEIGHT, container.height - clearance),
  }
}

export function getDefaultPanelHeight(containerHeight: number): number {
  if (containerHeight <= 0) return PANEL_MIN_HEIGHT
  return Math.max(
    PANEL_MIN_HEIGHT,
    Math.min(Math.round(containerHeight * PANEL_DEFAULT_HEIGHT_RATIO), containerHeight - 24),
  )
}

export function getDefaultPanelLayouts(
  containerWidth = 0,
  containerHeight = 0,
): LauncherPanelLayouts {
  const width = PANEL_DEFAULT_WIDTH
  const height = getDefaultPanelHeight(containerHeight)
  const rightX = Math.max(containerWidth - width, 0)
  const y = containerHeight > height ? Math.floor((containerHeight - height) / 2) : 0

  return {
    market: { x: 0, y, width, height },
    system: { x: rightX, y, width, height },
  }
}

export function clampPanelLayout(
  layout: LauncherPanelLayout,
  container: ContainerRect | null,
): LauncherPanelLayout {
  if (!container || container.width <= 0 || container.height <= 0) {
    return {
      x: Math.max(layout.x, 0),
      y: Math.max(layout.y, 0),
      width: Math.max(layout.width, PANEL_MIN_WIDTH),
      height: Math.max(layout.height, PANEL_MIN_HEIGHT),
    }
  }

  const containerWidth = container.width
  const containerHeight = container.height
  const width = Math.min(Math.max(layout.width, PANEL_MIN_WIDTH), containerWidth)
  let height = Math.min(Math.max(layout.height, PANEL_MIN_HEIGHT), containerHeight)
  let y = Math.max(layout.y, 0)
  const x = Math.min(Math.max(layout.x, 0), Math.max(containerWidth - width, 0))

  if (y + height > containerHeight) {
    y = Math.max(0, containerHeight - height)
  }

  const maxY = Math.max(containerHeight - height, 0)
  y = Math.min(y, maxY)

  if (y + height > containerHeight) {
    height = Math.max(PANEL_MIN_HEIGHT, containerHeight - y)
  }

  return { x, y, width, height }
}

export function panelLayoutNeedsRecovery(
  layout: LauncherPanelLayout,
  container: ContainerRect,
  defaults: LauncherPanelLayout,
): boolean {
  if (layout.height > container.height) return true

  const clamped = clampPanelLayout(layout, container)
  if (clamped.height >= container.height - 4) return true
  if (clamped.y + clamped.height > container.height + 1) return true

  const pinnedToBottom =
    clamped.y >= Math.max(container.height - clamped.height - 8, 0) && defaults.y < clamped.y - 24

  return pinnedToBottom
}

export function normalizePanelLayout(
  layout: LauncherPanelLayout,
  container: ContainerRect,
  defaults: LauncherPanelLayout,
): LauncherPanelLayout {
  if (panelLayoutNeedsRecovery(layout, container, defaults)) {
    return clampPanelLayout(
      {
        ...layout,
        width: defaults.width,
        height: defaults.height,
        y: defaults.y,
      },
      container,
    )
  }

  return clampPanelLayout(layout, container)
}

export function layoutsAreEqual(a: LauncherPanelLayouts, b: LauncherPanelLayouts): boolean {
  return (
    a.market.x === b.market.x &&
    a.market.y === b.market.y &&
    a.market.width === b.market.width &&
    a.market.height === b.market.height &&
    a.system.x === b.system.x &&
    a.system.y === b.system.y &&
    a.system.width === b.system.width &&
    a.system.height === b.system.height
  )
}
