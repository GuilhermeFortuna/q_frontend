import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { useActiveJobs } from '@/hooks/useActiveJobs'
import {
  particleFragmentShader,
  particleVertexShader,
  wireframeFragmentShader,
} from '@/components/cinematic/particleShaders'
import { CINEMATIC_PARTICLE_PHYSICS } from '@/lib/cinematic/cinematicParticlePhysics'
import { useAppStore } from '@/store/useAppStore'

const {
  shockwaveDuration: SHOCKWAVE_DURATION,
  maxDelta: MAX_DELTA,
  mouseLerp: MOUSE_LERP,
} = CINEMATIC_PARTICLE_PHYSICS

function createParticleScratch() {
  return {
    unprojectMouse: new THREE.Vector3(),
    mouseWorld: new THREE.Vector3(),
    mouseDir: new THREE.Vector3(),
    clickUnproject: new THREE.Vector3(),
    clickDir: new THREE.Vector3(),
    clickOrigin: new THREE.Vector3(),
  }
}

export function CinematicParticles() {
  const groupRef = useRef<THREE.Group>(null)
  const meshMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const pointsMaterialRef = useRef<THREE.ShaderMaterial>(null)

  const particleColorMode = useAppStore((s) => s.particleColorMode ?? 'gold')
  const particleSpeedMode = useAppStore((s) => s.particleSpeedMode ?? 'normal')

  // Generate Waving Grid Geometry (30 columns x 18 rows)
  const gridGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(62, 38, 30, 18)
  }, [])

  // Raycasting click logic
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

  // Raycasting hover logic
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

  // Palette Translation Map
  const colorMap = useMemo(
    () => ({
      gold: new THREE.Color(0.85, 0.62, 0.15), // Amber Gold
      cyan: new THREE.Color(0.0, 0.85, 0.95), // Quantum Teal
      violet: new THREE.Color(0.66, 0.33, 0.95), // Orchid Purple
      silver: new THREE.Color(0.72, 0.76, 0.82), // High-tech Silver
    }),
    [],
  )

  // Shared Shader Uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0.0 },
      uMouse: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
      uMouseStrength: { value: 1.0 },
      uShockwaveOrigin: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
      uShockwaveTime: { value: 0.0 },
      uColor: { value: new THREE.Color(0.85, 0.62, 0.15) },
      uGlow: { value: 0.0 },
    }),
    [],
  )

  useFrame((state) => {
    const delta = Math.min(state.clock.getDelta(), MAX_DELTA)

    // Speed configuration multipliers
    let speedMultiplier = 1.0
    if (particleSpeedMode === 'zero-g') {
      speedMultiplier = 0.08
    } else if (particleSpeedMode === 'hyper') {
      speedMultiplier = 4.5
    } else if (particleSpeedMode === 'reverse') {
      speedMultiplier = -1.0
    }

    const targetSpeed = (hasActiveJobs ? 2.5 : 1.0) * speedMultiplier
    currentSpeedRef.current = THREE.MathUtils.lerp(
      currentSpeedRef.current,
      targetSpeed,
      delta * 2.0,
    )
    accumulatedTimeRef.current += delta * currentSpeedRef.current

    const time = accumulatedTimeRef.current

    // Active job completions flash triggers
    if (lastHasActiveJobsRef.current && !hasActiveJobs) {
      glowRef.current = 1.0
    }
    lastHasActiveJobsRef.current = hasActiveJobs

    if (glowRef.current > 0.0) {
      glowRef.current = Math.max(0.0, glowRef.current - delta * 0.4)
    }

    const activePulse = hasActiveJobs
      ? 0.2 + 0.1 * Math.sin(state.clock.getElapsedTime() * 4.0)
      : 0.0
    const finalGlow = Math.max(glowRef.current, activePulse)

    // Map selected theme colors
    const selectedColor = colorMap[particleColorMode] || colorMap.gold

    // Update uniform values
    uniforms.uTime.value = time
    uniforms.uGlow.value = finalGlow
    uniforms.uColor.value = selectedColor

    // Soft lerp cursor pointer offsets
    lerpedMouse.current.x = THREE.MathUtils.lerp(lerpedMouse.current.x, mouse.current.x, MOUSE_LERP)
    lerpedMouse.current.y = THREE.MathUtils.lerp(lerpedMouse.current.y, mouse.current.y, MOUSE_LERP)

    // Raycast hover coordinate calculations to grid z=0 plane
    scratch.unprojectMouse.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
    scratch.mouseDir.copy(scratch.unprojectMouse).sub(state.camera.position).normalize()
    const mDist = -state.camera.position.z / scratch.mouseDir.z
    scratch.mouseWorld.copy(state.camera.position).addScaledVector(scratch.mouseDir, mDist)
    uniforms.uMouse.value.copy(scratch.mouseWorld)

    // Adjust cursor indentation force
    uniforms.uMouseStrength.value =
      particleSpeedMode === 'zero-g' ? 0.25 : particleSpeedMode === 'hyper' ? 2.8 : 1.0

    // Click shockwave propagation calculations
    const click = clickRef.current
    if (click.active) {
      if (!click.originComputed) {
        scratch.clickUnproject.set(click.x, click.y, 0.5).unproject(state.camera)
        scratch.clickDir.copy(scratch.clickUnproject).sub(state.camera.position).normalize()
        const cDist = -state.camera.position.z / scratch.clickDir.z
        scratch.clickOrigin.copy(state.camera.position).addScaledVector(scratch.clickDir, cDist)
        click.originComputed = true
        uniforms.uShockwaveOrigin.value.copy(scratch.clickOrigin)
      }
      click.time += delta
      uniforms.uShockwaveTime.value = click.time

      if (click.time > SHOCKWAVE_DURATION) {
        click.active = false
        click.originComputed = false
        uniforms.uShockwaveTime.value = 0.0
      }
    }

    // Parallax scene tilting
    if (groupRef.current) {
      groupRef.current.rotation.y = lerpedMouse.current.x * 0.06
      groupRef.current.rotation.x = -lerpedMouse.current.y * 0.04
    }
  })

  return (
    <group ref={groupRef}>
      {/* Volatility Surface Grid Mesh Connections */}
      <mesh geometry={gridGeometry}>
        <shaderMaterial
          ref={meshMaterialRef}
          vertexShader={particleVertexShader}
          fragmentShader={wireframeFragmentShader}
          uniforms={uniforms}
          wireframe={true}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Volatility Surface Intersection Nodes (Data Points) */}
      <points geometry={gridGeometry}>
        <shaderMaterial
          ref={pointsMaterialRef}
          vertexShader={particleVertexShader}
          fragmentShader={particleFragmentShader}
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
