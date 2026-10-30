import type { WorkspaceId } from '@/types/api'

export type CinematicQualityMode = 'launcher' | 'analysis' | 'heavy-3d' | 'reduced-motion'

export type CinematicQualityProfile = {
  mode: CinematicQualityMode
  sceneDim: number
  vignetteOpacity: number
  noiseOpacity: number
}

const LAUNCHER_WORKSPACES: WorkspaceId[] = ['launcher']

export function resolveCinematicQuality(input: {
  activeWorkspace: WorkspaceId
  reducedMotion: boolean
  documentHidden: boolean
  hasActiveFeature3D: boolean
}): CinematicQualityProfile {
  const { activeWorkspace, reducedMotion, documentHidden, hasActiveFeature3D } = input

  if (reducedMotion) {
    return {
      mode: 'reduced-motion',
      sceneDim: 0,
      vignetteOpacity: 1,
      noiseOpacity: 0.015,
    }
  }

  if (hasActiveFeature3D) {
    return {
      mode: 'heavy-3d',
      sceneDim: 0.55,
      vignetteOpacity: 0.65,
      noiseOpacity: 0.008,
    }
  }

  const isLauncher = LAUNCHER_WORKSPACES.includes(activeWorkspace)

  if (isLauncher) {
    return {
      mode: 'launcher',
      sceneDim: documentHidden ? 0.25 : 0,
      vignetteOpacity: 1,
      noiseOpacity: 0.015,
    }
  }

  return {
    mode: 'analysis',
    sceneDim: documentHidden ? 0.15 : 0,
    vignetteOpacity: 0.9,
    noiseOpacity: 0.012,
  }
}
