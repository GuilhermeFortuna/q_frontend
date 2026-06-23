/** Midground particle integration coefficients (stable module-level constants). */
export const CINEMATIC_PARTICLE_PHYSICS = {
  kSpring: 4.2,
  damping: 2.4,
  repelRadius: 7.0,
  repelForce: 15.0,
  shockwaveSpeed: 24.0,
  shockwaveThickness: 2.2,
  shockwaveForce: 35.0,
  shockwaveDuration: 0.85,
  maxDelta: 0.1,
  mouseLerp: 0.03,
} as const

export const CINEMATIC_PARTICLE_COUNT = 120
