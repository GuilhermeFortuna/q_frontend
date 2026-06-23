import { describe, expect, it } from 'vitest'

import {
  MAX_ALWAYS_ON_CANVASES_OUTSIDE_3D,
  MAX_APP_SHELL_ANIMATION_LOOPS,
  routeMountQueryBudget,
  TARGET_FPS,
} from '@/lib/performance/budgets'

describe('performance budgets', () => {
  it('documents shell canvas and animation loop ceilings', () => {
    expect(MAX_ALWAYS_ON_CANVASES_OUTSIDE_3D).toBe(0)
    expect(MAX_APP_SHELL_ANIMATION_LOOPS).toBe(0)
    expect(TARGET_FPS).toBeGreaterThanOrEqual(55)
  })

  it('maps routes to mount-query budgets', () => {
    expect(routeMountQueryBudget('/')).toBe(12)
    expect(routeMountQueryBudget('/backtests')).toBe(20)
    expect(routeMountQueryBudget('/discover')).toBe(16)
    expect(routeMountQueryBudget('/market-data')).toBe(18)
    expect(routeMountQueryBudget('/system')).toBeNull()
  })
})
