export const LIVING_SELECTOR = '.surface-panel--living'
export const SUEDE_SELECTOR = '.surface-suede, .surface-control'
export const SPOTLIGHT_SELECTOR = '.quant-panel--spotlight, .surface-panel--spotlight'
/** Host glow shells only — bloom marker uses `data-glow-bloom`, not `data-glow`. */
export const GLOW_SELECTOR = '[data-glow]'

const GLOW_OFF_X = '-999px'
const GLOW_OFF_Y = '-999px'

export function writeSpotVars(panel: HTMLElement, clientX: number, clientY: number) {
  const rect = panel.getBoundingClientRect()
  panel.style.setProperty('--spot-x', `${clientX - rect.left}px`)
  panel.style.setProperty('--spot-y', `${clientY - rect.top}px`)
}

/** Local pointer coords for `[data-glow]` (required under transformed ancestors). */
export function writeGlowVars(node: HTMLElement, clientX: number, clientY: number) {
  const rect = node.getBoundingClientRect()
  const width = rect.width || 1
  const height = rect.height || 1
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  node.style.setProperty('--x', `${localX.toFixed(2)}px`)
  node.style.setProperty('--y', `${localY.toFixed(2)}px`)
  node.style.setProperty('--xp', (localX / width).toFixed(2))
  node.style.setProperty('--yp', (localY / height).toFixed(2))
}

/** Park the spotlight off-card so border light does not freeze on a random edge. */
export function clearGlowVars(node: HTMLElement) {
  node.style.setProperty('--x', GLOW_OFF_X)
  node.style.setProperty('--y', GLOW_OFF_Y)
  node.style.removeProperty('--xp')
  node.style.removeProperty('--yp')
}

/** Every living panel or suede control from innermost to outermost along the ancestor chain. */
export function collectLivingAncestors(target: Element | null): HTMLElement[] {
  const panels: HTMLElement[] = []
  let el = target

  while (el) {
    if (el instanceof HTMLElement && (el.matches(LIVING_SELECTOR) || el.matches(SUEDE_SELECTOR))) {
      panels.push(el)
    }
    el = el.parentElement
  }

  return panels
}

/** Every glow host from innermost to outermost (skips bloom children). */
export function collectGlowAncestors(target: Element | null): HTMLElement[] {
  const nodes: HTMLElement[] = []
  let el = target

  while (el) {
    if (el instanceof HTMLElement && el.matches(GLOW_SELECTOR)) {
      nodes.push(el)
    }
    el = el.parentElement
  }

  return nodes
}

export function writeLivingSpotVars(target: Element | null, clientX: number, clientY: number) {
  for (const panel of collectLivingAncestors(target)) {
    writeSpotVars(panel, clientX, clientY)
  }
}

/**
 * Write glow vars to hosts under the pointer and clear hosts that are no longer active,
 * so border light never freezes on a stale top/bottom edge.
 */
export function writeGlowSpotVars(
  target: Element | null,
  clientX: number,
  clientY: number,
  previouslyActive: Iterable<HTMLElement> = [],
): HTMLElement[] {
  const next = collectGlowAncestors(target)
  const nextSet = new Set(next)

  for (const node of previouslyActive) {
    if (!nextSet.has(node)) {
      clearGlowVars(node)
    }
  }

  for (const node of next) {
    writeGlowVars(node, clientX, clientY)
  }

  return next
}

export function clearGlowSpotVars(nodes: Iterable<HTMLElement>) {
  for (const node of nodes) {
    clearGlowVars(node)
  }
}
