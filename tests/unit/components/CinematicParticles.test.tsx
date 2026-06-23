import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  CINEMATIC_PARTICLE_COUNT,
  CINEMATIC_PARTICLE_PHYSICS,
} from '@/lib/cinematic/cinematicParticlePhysics'

const particlesSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../src/components/cinematic/CinematicParticles.tsx',
)

/** Extract the `useFrame` callback body for static hot-path guard tests. */
export function extractUseFrameBody(source: string): string {
  const marker = 'useFrame((state) => {'
  const start = source.indexOf(marker)
  if (start === -1) {
    throw new Error('useFrame callback not found')
  }

  let index = start + marker.length
  let depth = 1
  while (index < source.length && depth > 0) {
    const char = source[index]
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    index += 1
  }

  return source.slice(start + marker.length, index - 1)
}

describe('CinematicParticles hot path', () => {
  it('keeps physics coefficients in a stable module export', () => {
    expect(CINEMATIC_PARTICLE_COUNT).toBe(120)
    expect(CINEMATIC_PARTICLE_PHYSICS.kSpring).toBeGreaterThan(0)
    expect(CINEMATIC_PARTICLE_PHYSICS.shockwaveDuration).toBeGreaterThan(0)
  })

  it('does not allocate Vector3 or call clone inside useFrame', () => {
    const source = readFileSync(particlesSourcePath, 'utf8')
    const frameBody = extractUseFrameBody(source)

    expect(frameBody).not.toMatch(/\.clone\s*\(/)
    expect(frameBody).not.toMatch(/new\s+THREE\.Vector3\s*\(/)
  })

  it('preallocates scratch vectors outside useFrame', () => {
    const source = readFileSync(particlesSourcePath, 'utf8')

    expect(source).toContain('createParticleScratch')
    expect(source).toContain('const scratch = useMemo(() => createParticleScratch(), [])')
  })
})
