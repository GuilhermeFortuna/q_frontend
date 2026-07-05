import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AppStore } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'

import { fadeRise, overlayEnter, overlayExit, staggerChildren, useReducedMotion } from '../index'

type MotionStoreSlice = Pick<AppStore, 'motionMode'>

// Mock useAppStore
vi.mock('@/store/useAppStore', () => {
  const store: MotionStoreSlice = {
    motionMode: 'full',
  }
  return {
    useAppStore: vi.fn((selector: (state: MotionStoreSlice) => unknown) => selector(store)),
  }
})

describe('Motion Presets & useReducedMotion', () => {
  it('presets expose correct token durations', () => {
    // Standard durations (reduced = false)
    const fadeRisePreset = fadeRise(false)
    expect(fadeRisePreset.visible.transition.duration).toBe(0.18) // --motion-base

    const overlayEnterPreset = overlayEnter(false)
    expect(overlayEnterPreset.visible.transition.duration).toBe(0.28) // --motion-slow

    const overlayExitPreset = overlayExit(false)
    expect(overlayExitPreset.exit.transition.duration).toBe(0.12) // --motion-fast

    const staggerPreset = staggerChildren(0.02, false)
    expect(staggerPreset.visible.transition.staggerChildren).toBe(0.02)
  })

  it('presets collapse to instant variants when reduced motion is true', () => {
    const fadeRisePreset = fadeRise(true)
    expect(fadeRisePreset.hidden.y).toBe(0)
    expect(fadeRisePreset.visible.transition.duration).toBe(0)

    const overlayEnterPreset = overlayEnter(true)
    expect(overlayEnterPreset.hidden.scale).toBe(1)
    expect(overlayEnterPreset.visible.transition.duration).toBe(0)

    const overlayExitPreset = overlayExit(true)
    expect(overlayExitPreset.exit.scale).toBe(1)
    expect(overlayExitPreset.exit.transition.duration).toBe(0)

    const staggerPreset = staggerChildren(0.02, true)
    expect(staggerPreset.visible.transition.staggerChildren).toBe(0)
  })

  it('useReducedMotion returns true under mocked prefers-reduced-motion and MotionToggle system mode', () => {
    // Mock matchMedia to return reduce
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    // The test store only carries the motion slice; widen it for the mock signature.
    const mockMotionMode = (motionMode: AppStore['motionMode']) =>
      vi
        .mocked(useAppStore)
        .mockImplementation(((selector: (state: AppStore) => unknown) =>
          selector({ motionMode } as AppStore)) as unknown as typeof useAppStore)

    // Case 1: motionMode = 'full', prefers-reduced-motion = reduce
    // Even if prefers-reduced-motion is true, motionMode 'full' overrides it.
    mockMotionMode('full')
    const { result: res1 } = renderHook(() => useReducedMotion())
    expect(res1.current).toBe(false)

    // Case 2: motionMode = 'system', prefers-reduced-motion = reduce
    // Under 'system', OS preference is respected.
    mockMotionMode('system')
    const { result: res2 } = renderHook(() => useReducedMotion())
    expect(res2.current).toBe(true)
  })
})
