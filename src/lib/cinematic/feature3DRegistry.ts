const activeSurfaces = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

/** Register a visible feature-specific 3D canvas (terrain, swarm, etc.). */
export function registerFeature3DSurface(id: string): () => void {
  activeSurfaces.add(id)
  notify()
  return () => {
    activeSurfaces.delete(id)
    notify()
  }
}

export function getFeature3DCount(): number {
  return activeSurfaces.size
}

export function getFeature3DIds(): string[] {
  return [...activeSurfaces]
}

export function subscribeFeature3D(listener: () => void): () => void {
  listeners.add(listener)
  listener()
  return () => listeners.delete(listener)
}

/** Test helper — clears all registrations. */
export function resetFeature3DRegistry(): void {
  activeSurfaces.clear()
  listeners.clear()
}
