import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'

import { BRANDED_BG_MAP, CLEAN_BG_MAP } from '@/components/cinematic/backgroundMaps'
import { CinematicParticles } from '@/components/cinematic/CinematicParticles'
import { useFeature3DActive } from '@/hooks/useFeature3DActive'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'
import { resolveCinematicQuality } from '@/lib/cinematic/cinematicQuality'
import { getPerformanceMonitor } from '@/lib/performance/performanceMonitor'
import { registerAnimationLoop } from '@/lib/performance/animationLoopRegistry'
import { useAppStore } from '@/store/useAppStore'

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false,
  )

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return hidden
}

export function CinematicScene() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const resolvedBrightness = useResolvedBrightness()
  const reducedMotion = usePrefersReducedMotion()
  const documentHidden = useDocumentHidden()
  const hasActiveFeature3D = useFeature3DActive()

  const profile = useMemo(
    () =>
      resolveCinematicQuality({
        activeWorkspace,
        reducedMotion,
        documentHidden,
        hasActiveFeature3D,
      }),
    [activeWorkspace, reducedMotion, documentHidden, hasActiveFeature3D],
  )

  const isLauncher = activeWorkspace === 'launcher'
  const brandedBg = BRANDED_BG_MAP[resolvedBrightness]
  const cleanBg = CLEAN_BG_MAP[resolvedBrightness]

  const loopActive = profile.showParticles && profile.animateLoop

  useEffect(() => {
    getPerformanceMonitor().setCinematicStats({
      qualityMode: profile.mode,
      loopActive,
    })
  }, [profile.mode, loopActive])

  useEffect(() => {
    if (!loopActive) return
    return registerAnimationLoop('cinematic-scene')
  }, [loopActive])

  return (
    <div
      aria-hidden
      data-testid="cinematic-scene"
      data-quality-mode={profile.mode}
      data-loop-active={loopActive ? 'true' : 'false'}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: `url('${brandedBg}')`,
          opacity: isLauncher ? 1 - profile.sceneDim : 0,
        }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: `url('${cleanBg}')`,
          opacity: isLauncher ? 0 : 1 - profile.sceneDim,
        }}
      />

      {profile.showParticles ? (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: profile.particleOpacity }}
        >
          <Canvas
            camera={{ position: [0, 0, 15], fov: 60 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            dpr={profile.dpr}
            frameloop={profile.animateLoop ? 'always' : 'never'}
          >
            <ambientLight intensity={0.5} />
            <CinematicParticles />
          </Canvas>
        </div>
      ) : null}

      <div
        className="quant-vignette-overlay transition-opacity duration-500"
        style={{ opacity: profile.vignetteOpacity }}
      />
      <div
        className="quant-noise-overlay transition-opacity duration-500"
        style={{ opacity: profile.noiseOpacity }}
      />
    </div>
  )
}

/** @deprecated Use CinematicScene — kept for legacy imports. */
export const QuantBackground = CinematicScene
