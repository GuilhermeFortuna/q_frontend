const activeLoops = new Set<string>()

/** Register a mounted cinematic / animation loop for perf HUD reporting. */
export function registerAnimationLoop(id: string): () => void {
  activeLoops.add(id)
  return () => {
    activeLoops.delete(id)
  }
}

export function getAnimationLoopCount(): number {
  return activeLoops.size
}

export function getAnimationLoopIds(): string[] {
  return [...activeLoops]
}

/** Test helper — clears all registrations. */
export function resetAnimationLoopRegistry(): void {
  activeLoops.clear()
}
