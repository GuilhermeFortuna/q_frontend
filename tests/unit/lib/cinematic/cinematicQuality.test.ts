import { describe, expect, it } from 'vitest'

import { resolveCinematicQuality } from '@/lib/cinematic/cinematicQuality'

describe('resolveCinematicQuality', () => {
  it('returns reduced-motion profile when motion is reduced', () => {
    const profile = resolveCinematicQuality({
      activeWorkspace: 'launcher',
      reducedMotion: true,
      documentHidden: false,
      hasActiveFeature3D: false,
    })

    expect(profile.mode).toBe('reduced-motion')
    expect(profile.sceneDim).toBe(0)
  })

  it('returns heavy-3d profile when a feature canvas is active', () => {
    const profile = resolveCinematicQuality({
      activeWorkspace: 'backtests',
      reducedMotion: false,
      documentHidden: false,
      hasActiveFeature3D: true,
    })

    expect(profile.mode).toBe('heavy-3d')
    expect(profile.sceneDim).toBeGreaterThan(0)
  })

  it('returns launcher profile on the launcher workspace', () => {
    const profile = resolveCinematicQuality({
      activeWorkspace: 'launcher',
      reducedMotion: false,
      documentHidden: false,
      hasActiveFeature3D: false,
    })

    expect(profile.mode).toBe('launcher')
    expect(profile.sceneDim).toBe(0)
  })

  it('dims launcher ambience when the document is hidden', () => {
    const visible = resolveCinematicQuality({
      activeWorkspace: 'launcher',
      reducedMotion: false,
      documentHidden: false,
      hasActiveFeature3D: false,
    })
    const hidden = resolveCinematicQuality({
      activeWorkspace: 'launcher',
      reducedMotion: false,
      documentHidden: true,
      hasActiveFeature3D: false,
    })

    expect(hidden.mode).toBe('launcher')
    expect(hidden.sceneDim).toBeGreaterThan(visible.sceneDim)
  })

  it('returns analysis profile for dense operational workspaces', () => {
    const profile = resolveCinematicQuality({
      activeWorkspace: 'backtests',
      reducedMotion: false,
      documentHidden: false,
      hasActiveFeature3D: false,
    })

    expect(profile.mode).toBe('analysis')
    expect(profile.sceneDim).toBe(0)
  })
})
