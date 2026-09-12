import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'

import {
  registerWorkspaceTransitionExecutor,
  useWorkspaceTransitionStore,
  WORKSPACE_TRANSITION_TIMINGS,
  type WorkspaceTransitionContext,
  type WorkspaceTransitionDirection,
  type WorkspaceTransitionSurfaceRole,
} from '@/components/transitions/workspaceTransitionStore'

gsap.registerPlugin(Flip)

const SURFACE_ROLES: WorkspaceTransitionSurfaceRole[] = [
  'primary',
  'secondary',
  'tertiary',
  'utility',
]

const MATERIAL_STYLE_KEYS = [
  'backgroundColor',
  'backgroundImage',
  'borderRadius',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'boxShadow',
  'backdropFilter',
  'opacity',
] as const

type CapturedSurface = {
  role: WorkspaceTransitionSurfaceRole
  rect: DOMRect
  styles: Partial<Record<(typeof MATERIAL_STYLE_KEYS)[number], string>>
  clone: HTMLElement
}

type CaptureBundle = {
  surfaces: CapturedSurface[]
  identity: {
    rect: DOMRect
    label: string
    clone: HTMLElement
  } | null
  layer: HTMLElement
}

function isForbiddenCloneSource(el: Element): boolean {
  const tag = el.tagName
  if (tag === 'CANVAS' || tag === 'VIDEO' || tag === 'IFRAME') return true
  if (el.getAttribute('role') === 'grid' || el.getAttribute('role') === 'rowgroup') return true
  if (el.hasAttribute('data-virtualized')) return true
  return false
}

function sanitizeClone(root: HTMLElement) {
  root.removeAttribute('id')
  root.removeAttribute('data-workspace-transition-root')
  root.removeAttribute('data-workspace-transition-anchor')
  root.querySelectorAll<HTMLElement>('*').forEach((node) => {
    node.removeAttribute('id')
    node.removeAttribute('tabindex')
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.disabled = true
    }
    if (isForbiddenCloneSource(node)) {
      node.replaceWith(document.createElement('div'))
    }
  })
  root.setAttribute('aria-hidden', 'true')
  root.tabIndex = -1
  root.style.pointerEvents = 'none'
}

function readMaterialStyles(el: HTMLElement) {
  const computed = getComputedStyle(el)
  const styles: CapturedSurface['styles'] = {}
  for (const key of MATERIAL_STYLE_KEYS) {
    styles[key] = computed[key]
  }
  return styles
}

function applyMaterialStyles(el: HTMLElement, styles: CapturedSurface['styles']) {
  for (const key of MATERIAL_STYLE_KEYS) {
    const value = styles[key]
    if (value != null) el.style[key] = value
  }
}

function placeFixed(el: HTMLElement, rect: DOMRect) {
  el.style.position = 'fixed'
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.top}px`
  el.style.width = `${rect.width}px`
  el.style.height = `${rect.height}px`
  el.style.margin = '0'
  el.style.boxSizing = 'border-box'
  el.style.overflow = 'hidden'
  el.style.zIndex = '10'
}

function queryWorkspaceRoot(workspaceId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-workspace-transition-root="${workspaceId}"]`)
}

function querySurfaces(root: HTMLElement): Map<WorkspaceTransitionSurfaceRole, HTMLElement> {
  const map = new Map<WorkspaceTransitionSurfaceRole, HTMLElement>()
  for (const role of SURFACE_ROLES) {
    const el = root.querySelector<HTMLElement>(`[data-workspace-transition-surface="${role}"]`)
    if (el) map.set(role, el)
  }
  return map
}

function queryAnchor(root: HTMLElement, workspaceId: string): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>(`[data-workspace-transition-anchor="${workspaceId}"]`) ??
    root.querySelector<HTMLElement>('[data-workspace-transition-anchor]')
  )
}

function waitForDestination(workspaceId: string, isCurrent: () => boolean): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = queryWorkspaceRoot(workspaceId)
    if (existing) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!isCurrent()) {
            reject(new Error('transition cancelled'))
            return
          }
          resolve(existing)
        })
      })
      return
    }

    let settled = false
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`missing destination workspace root: ${workspaceId}`))
    }, 1500)

    const observer = new MutationObserver(() => {
      const root = queryWorkspaceRoot(workspaceId)
      if (!root || settled) return
      settled = true
      cleanup()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!isCurrent()) {
            reject(new Error('transition cancelled'))
            return
          }
          resolve(root)
        })
      })
    })

    const cleanup = () => {
      window.clearTimeout(timeout)
      observer.disconnect()
    }

    observer.observe(document.getElementById('workspace-main') ?? document.body, {
      childList: true,
      subtree: true,
    })
  })
}

function directionalOffset(direction: WorkspaceTransitionDirection): number {
  return direction === 'forward' ? 12 : -12
}

function clearBundle(bundle: CaptureBundle | null) {
  if (!bundle) return
  gsap.killTweensOf(bundle.layer.querySelectorAll('*'))
  bundle.layer.remove()
}

type WorkspaceGridTransitionProps = {
  onSettled?: () => void
}

export function WorkspaceGridTransition({ onSettled }: WorkspaceGridTransitionProps) {
  const layerHostRef = useRef<HTMLDivElement>(null)
  const bundleRef = useRef<CaptureBundle | null>(null)
  const completionId = useWorkspaceTransitionStore((s) => s.completionId)
  const abortAndCommit = useWorkspaceTransitionStore((s) => s.abortAndCommit)
  const prevCompletionRef = useRef(completionId)

  useEffect(() => {
    if (completionId !== prevCompletionRef.current) {
      prevCompletionRef.current = completionId
      onSettled?.()
    }
  }, [completionId, onSettled])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void abortAndCommit()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void abortAndCommit()
    }
    const onResize = () => {
      if (useWorkspaceTransitionStore.getState().phase !== 'idle') void abortAndCommit()
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [abortAndCommit])

  useEffect(() => {
    const cancelVisuals = () => {
      clearBundle(bundleRef.current)
      bundleRef.current = null
      const main = document.getElementById('workspace-main')
      if (main) {
        gsap.killTweensOf(main)
        main.style.opacity = ''
      }
    }

    const onCapture = async (ctx: WorkspaceTransitionContext) => {
      cancelVisuals()
      const host = layerHostRef.current
      if (!host) return

      const root = queryWorkspaceRoot(ctx.from)
      const layer = document.createElement('div')
      layer.className = 'workspace-grid-transition'
      layer.setAttribute('aria-hidden', 'true')
      host.appendChild(layer)

      const surfaces: CapturedSurface[] = []
      if (root) {
        const found = querySurfaces(root)
        for (const [role, el] of found) {
          if (isForbiddenCloneSource(el)) continue
          const rect = el.getBoundingClientRect()
          if (rect.width < 2 || rect.height < 2) continue

          const clone = el.cloneNode(true) as HTMLElement
          sanitizeClone(clone)
          clone.classList.add('workspace-grid-transition__clone')
          clone.dataset.transitionRole = role
          const styles = readMaterialStyles(el)
          applyMaterialStyles(clone, styles)
          placeFixed(clone, rect)
          // Prefer a material shell look: strip heavy nested content for lightness.
          clone.replaceChildren()
          layer.appendChild(clone)
          surfaces.push({ role, rect, styles, clone })
        }
      }

      let identity: CaptureBundle['identity'] = null
      const dockEl = ctx.destinationDockElement
      // Capture the currently-active dock item visual as a traveling identity.
      // destinationDockElement is the destination item; use its label for copy and
      // measure the active page item if available, else the destination button itself.
      const activeDock =
        document.querySelector<HTMLElement>(
          'nav[aria-label="Workspace dock"] button[aria-current="page"]',
        ) ?? dockEl
      if (activeDock) {
        const rect = activeDock.getBoundingClientRect()
        const label =
          activeDock.getAttribute('aria-label') ?? dockEl.getAttribute('aria-label') ?? ctx.to
        const clone = document.createElement('div')
        clone.className =
          'workspace-grid-transition__clone workspace-grid-transition__clone--identity'
        clone.textContent = label
        clone.setAttribute('aria-hidden', 'true')
        placeFixed(clone, rect)
        layer.appendChild(clone)
        identity = { rect, label, clone }
      }

      bundleRef.current = { surfaces, identity, layer }
    }

    const onReconfigure = async (ctx: WorkspaceTransitionContext) => {
      const bundle = bundleRef.current
      if (!bundle) return

      let destinationRoot: HTMLElement
      try {
        destinationRoot = await waitForDestination(ctx.to, ctx.isCurrent)
      } catch {
        cancelVisuals()
        return
      }
      if (!ctx.isCurrent()) {
        cancelVisuals()
        return
      }

      const destSurfaces = querySurfaces(destinationRoot)
      const duration = WORKSPACE_TRANSITION_TIMINGS.durationMs / 1000
      const ease = WORKSPACE_TRANSITION_TIMINGS.ease
      const offset = directionalOffset(ctx.direction)
      const flipTargets: HTMLElement[] = []

      for (const captured of bundle.surfaces) {
        const dest = destSurfaces.get(captured.role)
        if (dest) {
          flipTargets.push(captured.clone)
          // Hide live destination surface until Flip settles.
          dest.style.opacity = '0'
          dest.dataset.transitionHidden = 'true'
        } else {
          gsap.to(captured.clone, {
            opacity: 0,
            y:
              offset > 0
                ? WORKSPACE_TRANSITION_TIMINGS.unmatchedRecedePx
                : -WORKSPACE_TRANSITION_TIMINGS.unmatchedRecedePx,
            duration: duration * 0.55,
            ease,
          })
        }
      }

      // Unmatched incoming: shell clones that fade in after 45%.
      const incomingOnly: HTMLElement[] = []
      for (const [role, dest] of destSurfaces) {
        if (bundle.surfaces.some((s) => s.role === role)) continue
        const rect = dest.getBoundingClientRect()
        const clone = document.createElement('div')
        clone.className = 'workspace-grid-transition__clone'
        clone.dataset.transitionRole = role
        applyMaterialStyles(clone, readMaterialStyles(dest))
        placeFixed(clone, rect)
        clone.style.opacity = '0'
        clone.style.transform = `translateX(${-offset}px)`
        bundle.layer.appendChild(clone)
        incomingOnly.push(clone)
        dest.style.opacity = '0'
        dest.dataset.transitionHidden = 'true'
      }

      const state = flipTargets.length > 0 ? Flip.getState(flipTargets) : null

      for (const captured of bundle.surfaces) {
        const dest = destSurfaces.get(captured.role)
        if (!dest) continue
        const destRect = dest.getBoundingClientRect()
        placeFixed(captured.clone, destRect)
        captured.clone.style.transform = `translateX(${offset * 0.15}px)`
      }

      await new Promise<void>((resolve) => {
        let pending = 1 + (incomingOnly.length > 0 ? 1 : 0) + (bundle.identity ? 1 : 0)
        const done = () => {
          pending -= 1
          if (pending <= 0) resolve()
        }

        if (state) {
          Flip.from(state, {
            duration,
            ease,
            absolute: true,
            onComplete: done,
          })
        } else {
          done()
        }

        if (incomingOnly.length > 0) {
          gsap.to(incomingOnly, {
            opacity: 1,
            x: 0,
            duration: duration * 0.55,
            delay: duration * WORKSPACE_TRANSITION_TIMINGS.unmatchedEnterProgress,
            ease,
            onComplete: done,
          })
        }

        if (bundle.identity) {
          const anchor = queryAnchor(destinationRoot, ctx.to)
          const destRect = anchor?.getBoundingClientRect() ?? {
            left: bundle.identity.rect.left,
            top: Math.max(72, bundle.identity.rect.top - 120),
            width: Math.max(bundle.identity.rect.width, 120),
            height: 36,
            right: 0,
            bottom: 0,
            x: 0,
            y: 0,
            toJSON() {
              return {}
            },
          }

          const identityState = Flip.getState(bundle.identity.clone)
          placeFixed(bundle.identity.clone, destRect as DOMRect)
          if (anchor?.textContent) {
            bundle.identity.clone.textContent = anchor.textContent.trim() || bundle.identity.label
          }

          Flip.from(identityState, {
            duration: duration * 0.85,
            ease,
            absolute: true,
            onComplete: () => {
              gsap.to(bundle.identity!.clone, {
                opacity: 0,
                duration: 0.12,
                onComplete: done,
              })
              if (anchor) {
                gsap.fromTo(anchor, { opacity: 0 }, { opacity: 1, duration: 0.12 })
              }
            },
          })
        }
      })

      for (const dest of destSurfaces.values()) {
        if (dest.dataset.transitionHidden === 'true') {
          dest.style.opacity = ''
          delete dest.dataset.transitionHidden
        }
      }

      cancelVisuals()
    }

    const onReducedMotion = async (ctx: WorkspaceTransitionContext) => {
      cancelVisuals()
      const main = document.getElementById('workspace-main')
      if (!main || !ctx.isCurrent()) return
      await new Promise<void>((resolve) => {
        gsap.fromTo(
          main,
          { opacity: 0.4 },
          {
            opacity: 1,
            duration: WORKSPACE_TRANSITION_TIMINGS.reducedMs / 1000,
            ease: 'power1.out',
            onComplete: () => {
              main.style.opacity = ''
              resolve()
            },
          },
        )
      })
    }

    registerWorkspaceTransitionExecutor({
      onCapture,
      onReconfigure,
      onReducedMotion,
      onCancel: cancelVisuals,
    })

    return () => {
      registerWorkspaceTransitionExecutor(null)
      cancelVisuals()
      void useWorkspaceTransitionStore.getState().dispose()
    }
  }, [])

  return <div ref={layerHostRef} className="contents" aria-hidden />
}
