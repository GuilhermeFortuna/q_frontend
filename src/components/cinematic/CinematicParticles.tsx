import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { useActiveJobs } from '@/hooks/useActiveJobs'
import {
  particleFragmentShader,
  particleVertexShader,
} from '@/components/cinematic/particleShaders'
import {
  CINEMATIC_PARTICLE_COUNT,
  CINEMATIC_PARTICLE_PHYSICS,
} from '@/lib/cinematic/cinematicParticlePhysics'

const {
  kSpring: K_SPRING,
  damping: DAMPING,
  repelRadius: REPEL_RADIUS,
  repelForce: REPEL_FORCE,
  shockwaveSpeed: SHOCKWAVE_SPEED,
  shockwaveThickness: SHOCKWAVE_THICKNESS,
  shockwaveForce: SHOCKWAVE_FORCE,
  shockwaveDuration: SHOCKWAVE_DURATION,
  maxDelta: MAX_DELTA,
  mouseLerp: MOUSE_LERP,
} = CINEMATIC_PARTICLE_PHYSICS

function createParticleScratch() {
  return {
    tempPos: new THREE.Vector3(),
    tempForce: new THREE.Vector3(),
    unprojectMouse: new THREE.Vector3(),
    mouseWorld: new THREE.Vector3(),
    mouseDir: new THREE.Vector3(),
    clickUnproject: new THREE.Vector3(),
    clickDir: new THREE.Vector3(),
    clickOrigin: new THREE.Vector3(),
    toMouse: new THREE.Vector3(),
    toShockwave: new THREE.Vector3(),
    invPointsMatrix: new THREE.Matrix4(),
  }
}

export function CinematicParticles() {
  const bgPointsRef = useRef<THREE.Points>(null)
  const midPointsRef = useRef<THREE.Points>(null)
  const fgPointsRef = useRef<THREE.Points>(null)

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const midMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const fgMaterialRef = useRef<THREE.ShaderMaterial>(null)

  const count = CINEMATIC_PARTICLE_COUNT

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
  }, [count])

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
  }, [count])

  const midSizes = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      arr[i] = 0.14 + Math.random() * 0.1 // 0.14 to 0.24 (medium specs)
    }
    return arr
  }, [count])

  const midPhases = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      arr[i] = Math.random() * 2 * Math.PI
    }
    return arr
  }, [count])

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
  const velocities = useMemo(() => new Float32Array(count * 3), [count])
  const displacements = useMemo(() => new Float32Array(count * 3), [count])

  // Click shockwave tracking
  const clickRef = useRef<{
    x: number
    y: number
    active: boolean
    time: number
    originComputed: boolean
  }>({
    x: 0,
    y: 0,
    active: false,
    time: 0,
    originComputed: false,
  })

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      clickRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
        active: true,
        time: 0,
        originComputed: false,
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

  const activeJobs = useActiveJobs()
  const hasActiveJobs = Object.keys(activeJobs).length > 0

  const accumulatedTimeRef = useRef(0)
  const currentSpeedRef = useRef(1.0)
  const lastHasActiveJobsRef = useRef(false)
  const glowRef = useRef(0.0)

  const scratch = useMemo(() => createParticleScratch(), [])

  // Shader Uniforms
  const uniformsBg = useMemo(() => ({ uTime: { value: 0 }, uGlow: { value: 0 } }), [])
  const uniformsMid = useMemo(() => ({ uTime: { value: 0 }, uGlow: { value: 0 } }), [])
  const uniformsFg = useMemo(() => ({ uTime: { value: 0 }, uGlow: { value: 0 } }), [])

  useFrame((state) => {
    const delta = Math.min(state.clock.getDelta(), MAX_DELTA)

    // Smoothly interpolate speed factor based on active job states
    const targetSpeed = hasActiveJobs ? 3.0 : 1.0
    currentSpeedRef.current = THREE.MathUtils.lerp(
      currentSpeedRef.current,
      targetSpeed,
      delta * 2.0,
    )
    accumulatedTimeRef.current += delta * currentSpeedRef.current

    const time = accumulatedTimeRef.current

    // Trigger success glow flash if a job transitions to complete (hasActiveJobs goes true -> false)
    if (lastHasActiveJobsRef.current && !hasActiveJobs) {
      glowRef.current = 1.0
    }
    lastHasActiveJobsRef.current = hasActiveJobs

    // Decay the success glow flash
    if (glowRef.current > 0.0) {
      glowRef.current = Math.max(0.0, glowRef.current - delta * 0.4) // fades out over ~2.5s
    }

    // Gentle pulse glow during active jobs
    const activePulse = hasActiveJobs
      ? 0.2 + 0.1 * Math.sin(state.clock.getElapsedTime() * 4.0)
      : 0.0
    const finalGlow = Math.max(glowRef.current, activePulse)

    // Update uniforms for shaders
    if (bgMaterialRef.current) {
      bgMaterialRef.current.uniforms.uTime.value = time
      bgMaterialRef.current.uniforms.uGlow.value = finalGlow
    }
    if (midMaterialRef.current) {
      midMaterialRef.current.uniforms.uTime.value = time
      midMaterialRef.current.uniforms.uGlow.value = finalGlow
    }
    if (fgMaterialRef.current) {
      fgMaterialRef.current.uniforms.uTime.value = time
      fgMaterialRef.current.uniforms.uGlow.value = finalGlow
    }

    // Smoothly lerp mouse coordinates to keep transitions soft
    lerpedMouse.current.x = THREE.MathUtils.lerp(lerpedMouse.current.x, mouse.current.x, MOUSE_LERP)
    lerpedMouse.current.y = THREE.MathUtils.lerp(lerpedMouse.current.y, mouse.current.y, MOUSE_LERP)

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
      scratch.unprojectMouse.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      scratch.mouseDir.copy(scratch.unprojectMouse).sub(state.camera.position).normalize()
      const mDist = -state.camera.position.z / scratch.mouseDir.z
      scratch.mouseWorld.copy(state.camera.position).addScaledVector(scratch.mouseDir, mDist)

      // Project click coordinates if shockwave is active
      const click = clickRef.current
      if (click.active) {
        if (!click.originComputed) {
          scratch.clickUnproject.set(click.x, click.y, 0.5).unproject(state.camera)
          scratch.clickDir.copy(scratch.clickUnproject).sub(state.camera.position).normalize()
          const cDist = -state.camera.position.z / scratch.clickDir.z
          scratch.clickOrigin.copy(state.camera.position).addScaledVector(scratch.clickDir, cDist)
          click.originComputed = true
        }
        click.time += delta
        if (click.time > SHOCKWAVE_DURATION) {
          click.active = false
          click.originComputed = false
        }
      }

      const geo = mid.geometry
      const posAttr = geo.attributes.position
      if (posAttr) {
        mid.updateMatrixWorld()
        scratch.invPointsMatrix.copy(mid.matrixWorld).invert()

        const posArray = posAttr.array as Float32Array
        const sRadius = click.active ? click.time * SHOCKWAVE_SPEED : 0

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
          scratch.tempPos.set(bx + dx, by + dy, bz + dz).applyMatrix4(mid.matrixWorld)

          scratch.tempForce.set(0, 0, 0)

          // A. Cursor Repulsion (in World Space)
          scratch.toMouse.copy(scratch.tempPos).sub(scratch.mouseWorld)
          const distToMouse = scratch.toMouse.length()
          if (distToMouse < REPEL_RADIUS && distToMouse > 0.1) {
            const forcePct = 1.0 - distToMouse / REPEL_RADIUS
            const repelImpulse = REPEL_FORCE * forcePct * forcePct
            scratch.tempForce.addScaledVector(scratch.toMouse.normalize(), repelImpulse)
          }

          // B. Click Shockwave (in World Space)
          if (click.active && click.originComputed) {
            scratch.toShockwave.copy(scratch.tempPos).sub(scratch.clickOrigin)
            const distToShockwave = scratch.toShockwave.length()
            const distFromFront = Math.abs(distToShockwave - sRadius)
            if (distFromFront < SHOCKWAVE_THICKNESS) {
              const shockPct = 1.0 - distFromFront / SHOCKWAVE_THICKNESS
              const fade = Math.max(0, 1.0 - click.time / SHOCKWAVE_DURATION)
              const shockImpulse = SHOCKWAVE_FORCE * shockPct * fade
              scratch.tempForce.addScaledVector(scratch.toShockwave.normalize(), shockImpulse)
            }
          }

          // Convert combined forces back to local space coordinates
          scratch.tempForce.applyMatrix4(scratch.invPointsMatrix)

          // Retrieve velocity components
          let vx = velocities[idx]
          let vy = velocities[idx + 1]
          let vz = velocities[idx + 2]

          // C. Spring Restoring Force (in local space)
          const springX = -K_SPRING * dx
          const springY = -K_SPRING * dy
          const springZ = -K_SPRING * dz

          // Euler integration step
          vx += (springX + scratch.tempForce.x) * delta
          vy += (springY + scratch.tempForce.y) * delta
          vz += (springZ + scratch.tempForce.z) * delta

          // Damping / Friction
          vx *= 1.0 - DAMPING * delta
          vy *= 1.0 - DAMPING * delta
          vz *= 1.0 - DAMPING * delta

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
          vertexShader={particleVertexShader}
          fragmentShader={particleFragmentShader}
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
          vertexShader={particleVertexShader}
          fragmentShader={particleFragmentShader}
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
          vertexShader={particleVertexShader}
          fragmentShader={particleFragmentShader}
          uniforms={uniformsFg}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}
