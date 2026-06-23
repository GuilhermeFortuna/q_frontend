import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const BRANDED_BG_MAP = {
  high: '/high_brightness/Quant_Background_High_Brightness.jpeg',
  mid: '/mid_brightness/Quant_Background_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Mid_Brightness.jpeg', // Fallback to Mid for now
}

const CLEAN_BG_MAP = {
  high: '/high_brightness/Quant_Background_Clean_High_Brightness.png',
  mid: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Clean_Mid_Brightness.jpeg', // Fallback to Mid for now
}

// Custom Shaders for reflective dust: motes that stay mostly dim and briefly catch
// the light with a sharp specular glint (+ diffraction spikes), like dust in a sunbeam.
const vertexShader = `
  uniform float uTime;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vGlint;

  void main() {
    vColor = aColor;

    // Per-particle glint cycle: varied period & phase so the field never flashes in unison.
    float speed = 0.5 + aPhase * 0.12;
    float wave = 0.5 + 0.5 * sin(uTime * speed + aPhase * 7.0);
    // High exponent -> flat-dark most of the cycle, then a brief sharp specular pop.
    float glint = pow(wave, 24.0);
    vGlint = glint;

    // Low resting baseline; the visible "dust" is mostly the glints riding on top.
    vTwinkle = 0.12 + 1.15 * glint;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Prevent division by zero or negative size for particles behind or close to camera
    float depth = max(0.1, -mvPosition.z);
    gl_PointSize = aSize * (1000.0 / depth);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vGlint;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    // Tight specular falloff (sharper than a soft glow) for a glinting pinpoint.
    float intensity = exp(-dist * 8.0);

    // Faint ambient halo so resting motes keep a soft presence.
    float aura = max(0.0, 1.0 - dist * 2.0);
    float halo = 0.10 * aura * aura;

    // Hot pinpoint core.
    float core = smoothstep(0.07, 0.0, dist) * 0.6;

    // Diffraction spikes: a thin cross that only appears at the instant of a glint.
    float spikeH = smoothstep(0.5, 0.0, abs(center.y) * 6.0) * smoothstep(0.5, 0.0, abs(center.x));
    float spikeV = smoothstep(0.5, 0.0, abs(center.x) * 6.0) * smoothstep(0.5, 0.0, abs(center.y));
    float spikes = (spikeH + spikeV) * vGlint * 0.45;

    float alpha = (intensity + halo + core + spikes) * vTwinkle;

    // Warm gold pop concentrated in the core; dim baseline stays cooler for contrast.
    vec3 finalColor = mix(vColor, vec3(1.0, 0.9, 0.62), smoothstep(0.06, 0.0, dist) * 0.7);

    gl_FragColor = vec4(finalColor, alpha);
  }
`

function ParticleStars() {
  const bgPointsRef = useRef<THREE.Points>(null)
  const midPointsRef = useRef<THREE.Points>(null)
  const fgPointsRef = useRef<THREE.Points>(null)

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const midMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const fgMaterialRef = useRef<THREE.ShaderMaterial>(null)

  const count = 120

  // 1. Generate Deep Background Dust Specs (250 particles, static on CPU, rotates on GPU)
  const bgPositions = useMemo(() => {
    const arr = new Float32Array(250 * 3)
    for (let i = 0; i < 250; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 55 // Width span
      arr[i * 3 + 1] = (Math.random() - 0.5) * 35 // Height span
      arr[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10 // Pushed back a bit
    }
    return arr
  }, [])

  const bgColors = useMemo(() => {
    const arr = new Float32Array(250 * 3)
    for (let i = 0; i < 250; i++) {
      const type = Math.random()
      if (type < 0.5) {
        // Muted bronze/copper dust (r=0.7, g=0.45, b=0.25)
        arr[i * 3] = 0.65 + Math.random() * 0.1
        arr[i * 3 + 1] = 0.4 + Math.random() * 0.1
        arr[i * 3 + 2] = 0.2 + Math.random() * 0.1
      } else {
        // Soft sepia/gold dust (r=0.8, g=0.6, b=0.35)
        arr[i * 3] = 0.75 + Math.random() * 0.1
        arr[i * 3 + 1] = 0.55 + Math.random() * 0.1
        arr[i * 3 + 2] = 0.3 + Math.random() * 0.1
      }
    }
    return arr
  }, [])

  const bgSizes = useMemo(() => {
    const arr = new Float32Array(250)
    for (let i = 0; i < 250; i++) {
      arr[i] = 0.05 + Math.random() * 0.06 // 0.05 to 0.11 (tiny background dust specs)
    }
    return arr
  }, [])

  const bgPhases = useMemo(() => {
    const arr = new Float32Array(250)
    for (let i = 0; i < 250; i++) {
      arr[i] = Math.random() * 2 * Math.PI
    }
    return arr
  }, [])

  // 2. Generate Interactive Midground Dust Specs (120 particles, responds to mouse and click shockwaves)
  const basePositions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 45 // Width span
      arr[i * 3 + 1] = (Math.random() - 0.5) * 28 // Height span
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30 // Depth span
    }
    return arr
  }, [])

  const midColors = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const type = Math.random()
      if (type < 0.6) {
        // Deep gold dust (#d4af37 -> rgb(0.83, 0.68, 0.21))
        arr[i * 3] = 0.8 + Math.random() * 0.08
        arr[i * 3 + 1] = 0.65 + Math.random() * 0.08
        arr[i * 3 + 2] = 0.18 + Math.random() * 0.08
      } else {
        // Warm copper/amber dust (rgb(0.8, 0.48, 0.18))
        arr[i * 3] = 0.75 + Math.random() * 0.1
        arr[i * 3 + 1] = 0.43 + Math.random() * 0.1
        arr[i * 3 + 2] = 0.15 + Math.random() * 0.08
      }
    }
    return arr
  }, [])

  const midSizes = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      arr[i] = 0.14 + Math.random() * 0.1 // 0.14 to 0.24 (medium specs)
    }
    return arr
  }, [])

  const midPhases = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      arr[i] = Math.random() * 2 * Math.PI
    }
    return arr
  }, [])

  // 3. Generate Foreground Bokeh Dust (15 large, out-of-focus soft particles floating close)
  const fgPositions = useMemo(() => {
    const arr = new Float32Array(15 * 3)
    for (let i = 0; i < 15; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 35
      arr[i * 3 + 1] = (Math.random() - 0.5) * 22
      arr[i * 3 + 2] = (Math.random() - 0.5) * 15 + 5 // Pushed closer to camera
    }
    return arr
  }, [])

  const fgColors = useMemo(() => {
    const arr = new Float32Array(15 * 3)
    for (let i = 0; i < 15; i++) {
      // Warm bronze/amber bokeh dust (rgb(0.85, 0.55, 0.25))
      arr[i * 3] = 0.8 + Math.random() * 0.1
      arr[i * 3 + 1] = 0.5 + Math.random() * 0.1
      arr[i * 3 + 2] = 0.2 + Math.random() * 0.1
    }
    return arr
  }, [])

  const fgSizes = useMemo(() => {
    const arr = new Float32Array(15)
    for (let i = 0; i < 15; i++) {
      arr[i] = 0.4 + Math.random() * 0.35 // 0.4 to 0.75 (large out-of-focus bokeh)
    }
    return arr
  }, [])

  const fgPhases = useMemo(() => {
    const arr = new Float32Array(15)
    for (let i = 0; i < 15; i++) {
      arr[i] = Math.random() * 2 * Math.PI
    }
    return arr
  }, [])

  // Keep track of velocities and displacements in local space for interactive Midground
  const velocities = useMemo(() => new Float32Array(count * 3), [])
  const displacements = useMemo(() => new Float32Array(count * 3), [])

  // Click shockwave tracking
  const clickRef = useRef<{
    x: number
    y: number
    active: boolean
    time: number
    origin3D?: THREE.Vector3
  }>({
    x: 0,
    y: 0,
    active: false,
    time: 0,
  })

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      clickRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
        active: true,
        time: 0,
      }
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Keep track of normalized cursor position globally
  const mouse = useRef({ x: 0, y: 0 })
  const lerpedMouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Temporary Math objects to prevent GC thrashing inside the animation loop
  const tempPos = useMemo(() => new THREE.Vector3(), [])
  const tempVector = useMemo(() => new THREE.Vector3(), [])
  const tempMouse3D = useMemo(() => new THREE.Vector3(), [])
  const invPointsMatrix = useMemo(() => new THREE.Matrix4(), [])

  // Shader Uniforms
  const uniformsBg = useMemo(() => ({ uTime: { value: 0 } }), [])
  const uniformsMid = useMemo(() => ({ uTime: { value: 0 } }), [])
  const uniformsFg = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    const delta = Math.min(state.clock.getDelta(), 0.1) // Cap delta to prevent huge jumps on tab switch

    // Update uTime uniform for shaders to trigger GPU twinkling animations
    if (bgMaterialRef.current) bgMaterialRef.current.uniforms.uTime.value = time
    if (midMaterialRef.current) midMaterialRef.current.uniforms.uTime.value = time
    if (fgMaterialRef.current) fgMaterialRef.current.uniforms.uTime.value = time

    // Smoothly lerp mouse coordinates to keep transitions soft
    lerpedMouse.current.x = THREE.MathUtils.lerp(lerpedMouse.current.x, mouse.current.x, 0.03)
    lerpedMouse.current.y = THREE.MathUtils.lerp(lerpedMouse.current.y, mouse.current.y, 0.03)

    // 1. Animate Deep Background: slow independent rotation drift + subtle cursor parallax
    if (bgPointsRef.current) {
      const bg = bgPointsRef.current
      bg.rotation.y = time * 0.015 + lerpedMouse.current.x * 0.03
      bg.rotation.x = time * 0.008 + lerpedMouse.current.y * 0.03
    }

    // 2. Animate Midground (Interactive): main drift + responsive cursor parallax tilt
    if (midPointsRef.current) {
      const mid = midPointsRef.current
      mid.rotation.y = time * 0.035 + lerpedMouse.current.x * 0.08
      mid.rotation.x = time * 0.018 + lerpedMouse.current.y * 0.08

      // Unproject mouse coordinates to find world-space cursor position
      tempMouse3D.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      const mDir = tempMouse3D.sub(state.camera.position).normalize()
      const mDist = -state.camera.position.z / mDir.z
      const mouse3D = state.camera.position.clone().add(mDir.multiplyScalar(mDist))

      // Project click coordinates if shockwave is active
      const click = clickRef.current
      if (click.active) {
        if (click.time === 0) {
          const tempClick3D = new THREE.Vector3(click.x, click.y, 0.5).unproject(state.camera)
          const cDir = tempClick3D.sub(state.camera.position).normalize()
          const cDist = -state.camera.position.z / cDir.z
          click.origin3D = state.camera.position.clone().add(cDir.multiplyScalar(cDist))
        }
        click.time += delta
        if (click.time > 0.85) {
          click.active = false
        }
      }

      const geo = mid.geometry
      const posAttr = geo.attributes.position
      if (posAttr) {
        mid.updateMatrixWorld()
        invPointsMatrix.copy(mid.matrixWorld).invert()

        const posArray = posAttr.array as Float32Array

        // Physical coefficients
        const kSpring = 4.2
        const damping = 2.4
        const repelRadius = 7.0
        const repelForce = 15.0
        const shockwaveSpeed = 24.0
        const shockwaveThickness = 2.2
        const shockwaveForce = 35.0

        const sRadius = click.active ? click.time * shockwaveSpeed : 0
        const sOrigin = click.origin3D

        // Integrate particle mechanics
        for (let i = 0; i < count; i++) {
          const idx = i * 3
          const bx = basePositions[idx]
          const by = basePositions[idx + 1]
          const bz = basePositions[idx + 2]

          const dx = displacements[idx]
          const dy = displacements[idx + 1]
          const dz = displacements[idx + 2]

          // Determine local coordinates & transform to world space for mouse interaction
          tempPos.set(bx + dx, by + dy, bz + dz).applyMatrix4(mid.matrixWorld)

          // Initialize force vector
          tempVector.set(0, 0, 0)

          // A. Cursor Repulsion (in World Space)
          const toMouse = tempPos.clone().sub(mouse3D)
          const distToMouse = toMouse.length()
          if (distToMouse < repelRadius && distToMouse > 0.1) {
            const forcePct = 1.0 - distToMouse / repelRadius
            const repelImpulse = repelForce * forcePct * forcePct
            tempVector.addScaledVector(toMouse.normalize(), repelImpulse)
          }

          // B. Click Shockwave (in World Space)
          if (click.active && sOrigin) {
            const toShockwave = tempPos.clone().sub(sOrigin)
            const distToShockwave = toShockwave.length()
            const distFromFront = Math.abs(distToShockwave - sRadius)
            if (distFromFront < shockwaveThickness) {
              const shockPct = 1.0 - distFromFront / shockwaveThickness
              const fade = Math.max(0, 1.0 - click.time / 0.85)
              const shockImpulse = shockwaveForce * shockPct * fade
              tempVector.addScaledVector(toShockwave.normalize(), shockImpulse)
            }
          }

          // Convert combined forces back to local space coordinates
          tempVector.applyMatrix4(invPointsMatrix)

          // Retrieve velocity components
          let vx = velocities[idx]
          let vy = velocities[idx + 1]
          let vz = velocities[idx + 2]

          // C. Spring Restoring Force (in local space)
          const springX = -kSpring * dx
          const springY = -kSpring * dy
          const springZ = -kSpring * dz

          // Euler integration step
          vx += (springX + tempVector.x) * delta
          vy += (springY + tempVector.y) * delta
          vz += (springZ + tempVector.z) * delta

          // Damping / Friction
          vx *= 1.0 - damping * delta
          vy *= 1.0 - damping * delta
          vz *= 1.0 - damping * delta

          // Save velocities
          velocities[idx] = vx
          velocities[idx + 1] = vy
          velocities[idx + 2] = vz

          // Update displacements
          displacements[idx] += vx * delta
          displacements[idx + 1] += vy * delta
          displacements[idx + 2] += vz * delta

          // Output to vertex position buffer
          posArray[idx] = bx + displacements[idx]
          posArray[idx + 1] = by + displacements[idx + 1]
          posArray[idx + 2] = bz + displacements[idx + 2]
        }

        posAttr.needsUpdate = true
      }
    }

    // 3. Animate Foreground Bokeh: drifts faster + stronger cursor parallax tilt for depth of field
    if (fgPointsRef.current) {
      const fg = fgPointsRef.current
      fg.rotation.y = time * 0.05 + lerpedMouse.current.x * 0.15
      fg.rotation.x = time * 0.025 + lerpedMouse.current.y * 0.15
    }
  })

  return (
    <>
      {/* Deep Background Stars Layer */}
      <points ref={bgPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bgPositions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[bgColors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[bgSizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[bgPhases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={bgMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniformsBg}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Interactive Midground Stars Layer */}
      <points ref={midPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[basePositions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[midColors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[midSizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[midPhases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={midMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniformsMid}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Foreground Bokeh Stars Layer */}
      <points ref={fgPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fgPositions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[fgColors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[fgSizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[fgPhases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={fgMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniformsFg}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}

export function QuantBackground() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const resolvedBrightness = useResolvedBrightness()
  const reducedMotion = usePrefersReducedMotion()
  const isLauncher = activeWorkspace === 'launcher'
  const showParticleField = isLauncher && !reducedMotion

  const brandedBg = BRANDED_BG_MAP[resolvedBrightness]
  const cleanBg = CLEAN_BG_MAP[resolvedBrightness]

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Background image in Launcher workspace */}
      <div
        className={cn(
          'absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700',
          isLauncher ? 'opacity-100' : 'opacity-0',
        )}
        style={{ backgroundImage: `url('${brandedBg}')` }}
      />
      {/* Cleaner background image in other workspaces */}
      <div
        className={cn(
          'absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700',
          isLauncher ? 'opacity-0' : 'opacity-100',
        )}
        style={{ backgroundImage: `url('${cleanBg}')` }}
      />

      {showParticleField ? (
        <div className="absolute inset-0 opacity-85">
          <Canvas
            camera={{ position: [0, 0, 15], fov: 60 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            dpr={1}
          >
            <ambientLight intensity={0.5} />
            <ParticleStars />
          </Canvas>
        </div>
      ) : null}
    </div>
  )
}
