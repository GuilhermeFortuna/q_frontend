import { describe, expect, it } from 'vitest'

import {
  CINEMATIC_PARTICLE_COUNT,
  CINEMATIC_PARTICLE_PHYSICS,
} from '@/lib/cinematic/cinematicParticlePhysics'

describe('cinematicParticlePhysics', () => {
  it('exports stable midground particle count', () => {
    expect(CINEMATIC_PARTICLE_COUNT).toBe(120)
  })

  it('exports interaction coefficients used by the launcher particle loop', () => {
    expect(CINEMATIC_PARTICLE_PHYSICS).toMatchObject({
      kSpring: 4.2,
      damping: 2.4,
      repelRadius: 7.0,
      repelForce: 15.0,
      shockwaveSpeed: 24.0,
      shockwaveThickness: 2.2,
      shockwaveForce: 35.0,
      shockwaveDuration: 0.85,
    })
  })
})
