import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Center, Resize, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { cn } from '@/lib/utils'

const EMBLEM_URL = '/quant-emblem.glb'

function enhanceMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      material.envMapIntensity = 1.4
      material.metalness = Math.min(material.metalness + 0.1, 1)
      material.roughness = Math.max(material.roughness - 0.08, 0.25)
    }
  })
}

function EmblemModel() {
  const { scene } = useGLTF(EMBLEM_URL)
  const model = useMemo(() => {
    const cloned = scene.clone(true)
    enhanceMaterials(cloned)
    return cloned
  }, [scene])

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <Resize scale={1.35}>
        <Center>
          <primitive object={model} />
        </Center>
      </Resize>
    </group>
  )
}

useGLTF.preload(EMBLEM_URL)

function EmblemLights() {
  return (
    <>
      <ambientLight intensity={0.85} color="#f0e6d0" />
      <hemisphereLight args={['#d4b06a', '#1a1008', 0.7]} />
      <directionalLight position={[3, 4, 5]} intensity={1.8} color="#f0e6d0" />
      <directionalLight position={[-4, 1, 2]} intensity={0.65} color="#c4a574" />
      <pointLight position={[0, -1, 3]} intensity={0.9} color="#d4b06a" distance={10} />
      <spotLight
        position={[0, 5, 2]}
        angle={0.45}
        penumbra={0.6}
        intensity={1.3}
        color="#c9b896"
        distance={12}
      />
    </>
  )
}

type QuantEmblemProps = {
  className?: string
}

export function QuantEmblem({ className }: QuantEmblemProps) {
  return (
    <div
      className={cn(
        'h-14 w-14 shrink-0',
        'drop-shadow-[0_0_10px_color-mix(in_srgb,var(--color-gold-400)_28%,transparent)]',
        className,
      )}
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 28 }}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMappingExposure = 1.35
        }}
      >
        <EmblemLights />
        <Suspense fallback={null}>
          <EmblemModel />
        </Suspense>
      </Canvas>
    </div>
  )
}
