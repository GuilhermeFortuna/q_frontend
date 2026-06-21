import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'

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

function ParticleStars() {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 120

  // Generate random coordinates for floating stars
  const basePositions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 45 // Width span
      arr[i * 3 + 1] = (Math.random() - 0.5) * 28 // Height span
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30 // Depth span
    }
    return arr
  }, [])

  // Keep track of velocities and displacements in local space
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

  useFrame((state) => {
    if (!pointsRef.current) return
    const points = pointsRef.current
    const geo = points.geometry
    const posAttr = geo.attributes.position
    if (!posAttr) return

    // Smoothly lerp mouse coordinates to keep transitions soft
    lerpedMouse.current.x = THREE.MathUtils.lerp(lerpedMouse.current.x, mouse.current.x, 0.03)
    lerpedMouse.current.y = THREE.MathUtils.lerp(lerpedMouse.current.y, mouse.current.y, 0.03)

    const time = state.clock.getElapsedTime()
    const delta = Math.min(state.clock.getDelta(), 0.1) // Cap delta to prevent huge jumps on tab switch

    // Combined rotation: continuous slow drift + smooth cursor parallax tilt
    points.rotation.y = time * 0.04 + lerpedMouse.current.x * 0.1
    points.rotation.x = time * 0.02 + lerpedMouse.current.y * 0.1

    points.updateMatrixWorld()
    invPointsMatrix.copy(points.matrixWorld).invert()

    // 1. Unproject mouse coordinates to find world-space cursor position
    tempMouse3D.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
    const mDir = tempMouse3D.sub(state.camera.position).normalize()
    const mDist = -state.camera.position.z / mDir.z
    const mouse3D = state.camera.position.clone().add(mDir.multiplyScalar(mDist))

    // 2. Project click coordinates if shockwave is active
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

    // 3. Integrate particle mechanics
    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const bx = basePositions[idx]
      const by = basePositions[idx + 1]
      const bz = basePositions[idx + 2]

      const dx = displacements[idx]
      const dy = displacements[idx + 1]
      const dz = displacements[idx + 2]

      // Determine local coordinates & transform to world space for mouse interaction
      tempPos.set(bx + dx, by + dy, bz + dz).applyMatrix4(points.matrixWorld)

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
  })

  return (
    <Points ref={pointsRef} positions={basePositions} stride={3}>
      <PointMaterial
        transparent
        color="#ffca47" // matching gold-400 theme
        size={0.24}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  )
}

export function QuantBackground() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const resolvedBrightness = useResolvedBrightness()
  const isLauncher = activeWorkspace === 'launcher'

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

      {/* GPU-Accelerated 3D Parallax Starfield overlay */}
      <div className="absolute inset-0 opacity-85">
        <Canvas
          camera={{ position: [0, 0, 15], fov: 60 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={0.5} />
          <ParticleStars />
        </Canvas>
      </div>
    </div>
  )
}
