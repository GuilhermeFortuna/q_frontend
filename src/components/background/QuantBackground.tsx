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
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 45 // Width span
      arr[i * 3 + 1] = (Math.random() - 0.5) * 28 // Height span
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30 // Depth span
    }
    return arr
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

  useFrame((state) => {
    if (!pointsRef.current) return

    // Smoothly lerp mouse coordinates to keep transitions soft
    lerpedMouse.current.x = THREE.MathUtils.lerp(lerpedMouse.current.x, mouse.current.x, 0.03)
    lerpedMouse.current.y = THREE.MathUtils.lerp(lerpedMouse.current.y, mouse.current.y, 0.03)

    const time = state.clock.getElapsedTime()

    // Combined rotation: continuous slow drift + smooth cursor parallax tilt
    pointsRef.current.rotation.y = time * 0.04 + lerpedMouse.current.x * 0.1
    pointsRef.current.rotation.x = time * 0.02 + lerpedMouse.current.y * 0.1
  })

  return (
    <Points ref={pointsRef} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#ffca47" // matching gold-400 theme
        size={0.15}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.28}
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
      <div className="absolute inset-0 opacity-40">
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
