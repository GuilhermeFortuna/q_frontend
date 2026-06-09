import React, { useMemo, useState, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { RotateCcw, Eye, EyeOff, Sparkles, HelpCircle, Trophy } from 'lucide-react'
import type { OptimizationResults } from '@/types/optimization'

// WebGL Canvas error boundary
class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WebGL Canvas Error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Scene controller to reset camera programmatically
function SceneControls({ resetCounter }: { resetCounter: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()

  useEffect(() => {
    if (resetCounter > 0 && controlsRef.current) {
      camera.position.set(16, 12, 16)
      camera.lookAt(0, 0, 0)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [resetCounter, camera])

  return <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />
}

// Particle field for ambient depth
function ParticleField({ count = 250 }) {
  const points = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 35
      arr[i * 3 + 1] = (Math.random() - 0.5) * 15
      arr[i * 3 + 2] = (Math.random() - 0.5) * 35
    }
    return arr
  }, [count])

  return (
    <Points positions={points} stride={3}>
      <PointMaterial
        transparent
        color="#c5a880"
        size={0.05}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.3}
      />
    </Points>
  )
}

// Format values for human readability
function formatVal(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(4)
  }
  return String(value)
}

type OptimizationTerrain3DProps = {
  results: OptimizationResults
  selectedTrialNumber: number | null
  onSelectTrial: (trialNumber: number | null) => void
}

export function OptimizationTerrain3D({
  results,
  selectedTrialNumber,
  onSelectTrial,
}: OptimizationTerrain3DProps) {
  const completedTrials = useMemo(
    () => results.trials.filter((t) => t.values && t.values.length > 0),
    [results.trials],
  )

  // Find all numeric trial parameter keys
  const parameterKeys = useMemo(() => {
    const keys = new Set<string>()
    completedTrials.forEach((t) => {
      Object.entries(t.params).forEach(([k, v]) => {
        if (typeof v === 'number') {
          keys.add(k)
        }
      })
    })
    return Array.from(keys)
  }, [completedTrials])

  // Find all numeric metric keys inside user_attrs.metrics
  const metricKeys = useMemo(() => {
    const keys = new Set<string>()
    completedTrials.forEach((t) => {
      if (t.user_attrs.metrics) {
        Object.entries(t.user_attrs.metrics).forEach(([k, v]) => {
          if (typeof v === 'number') {
            keys.add(k)
          }
        })
      }
    })
    return Array.from(keys)
  }, [completedTrials])

  // Selectable Axis States
  const [xKey, setXKey] = useState<string>(parameterKeys[0] || '')
  const [yKey, setYKey] = useState<string>(parameterKeys[1] || parameterKeys[0] || '')
  const [zKey, setZKey] = useState<string>('objective')

  // Display Option States
  const [showWireframe, setShowWireframe] = useState(true)
  const [showParticles, setShowParticles] = useState(true)
  const [resetCounter, setResetCounter] = useState(0)

  // Hover States
  const [hoveredTrial, setHoveredTrial] = useState<number | null>(null)

  // Default values if parameters/metrics are missing
  useEffect(() => {
    if (!xKey && parameterKeys.length > 0) setXKey(parameterKeys[0])
    if (!yKey && parameterKeys.length > 1) setYKey(parameterKeys[1])
  }, [parameterKeys, xKey, yKey])

  // 3D Procedural Math: IDW mesh generation & Normalization
  const { vertices, indices, normalizedTrials } = useMemo(() => {
    if (completedTrials.length === 0 || !xKey || !yKey) {
      return {
        vertices: new Float32Array(0),
        indices: new Uint32Array(0),
        normalizedTrials: [],
      }
    }

    // Extract raw values
    const xVals = completedTrials.map((t) => Number(t.params[xKey] ?? 0))
    const yVals = completedTrials.map((t) => Number(t.params[yKey] ?? 0))
    const zVals = completedTrials.map((t) => {
      if (zKey === 'objective') {
        return Number(t.values?.[0] ?? 0)
      }
      return Number(t.user_attrs.metrics?.[zKey] ?? 0)
    })

    // Bounds check
    const xMin = Math.min(...xVals),
      xMax = Math.max(...xVals),
      xRange = xMax - xMin || 1
    const yMin = Math.min(...yVals),
      yMax = Math.max(...yVals),
      yRange = yMax - yMin || 1
    const zMin = Math.min(...zVals),
      zMax = Math.max(...zVals),
      zRange = zMax - zMin || 1

    const scaleX = 24
    const scaleZ = 24
    const scaleY = 6

    // Normalize coordinates to fits inside 3D Canvas Box:
    // X: [-scaleX/2, scaleX/2], Y (Height): [-scaleY/2, scaleY/2], Z (Depth): [-scaleZ/2, scaleZ/2]
    const normalizedTrials = completedTrials.map((t, idx) => {
      const nx = (xVals[idx] - xMin) / xRange
      const ny = (yVals[idx] - yMin) / yRange
      const nz = (zVals[idx] - zMin) / zRange

      return {
        number: t.number,
        originalX: xVals[idx],
        originalY: yVals[idx],
        originalZ: zVals[idx],
        x: nx * scaleX - scaleX / 2,
        y: nz * scaleY - scaleY / 2, // Y is vertical height in Three.js
        z: ny * scaleZ - scaleZ / 2, // Z is depth in Three.js (mapped from param Y)
        raw: t,
      }
    })

    // Create 30 x 30 grid height values
    const gridDim = 30
    const vertices = new Float32Array(gridDim * gridDim * 3)

    for (let i = 0; i < gridDim; i++) {
      const u = i / (gridDim - 1)
      const x = u * scaleX - scaleX / 2

      for (let j = 0; j < gridDim; j++) {
        const v = j / (gridDim - 1)
        const z = v * scaleZ - scaleZ / 2

        // Inverse Distance Weighting (IDW) interpolation
        let height = 0
        if (normalizedTrials.length > 0) {
          let weightSum = 0
          let valueSum = 0
          const epsilon = 0.01 // Smoothing factor

          for (const nt of normalizedTrials) {
            // Distance in normalized coordinates
            const nx = u
            const nz = v
            const tx = (nt.x + scaleX / 2) / scaleX
            const tz = (nt.z + scaleZ / 2) / scaleZ

            const distSq = (nx - tx) ** 2 + (nz - tz) ** 2
            const weight = 1 / (distSq + epsilon)

            weightSum += weight
            // nt.y is in [-scaleY/2, scaleY/2], convert back to [0, 1] for interpolation
            valueSum += weight * ((nt.y + scaleY / 2) / scaleY)
          }
          height = valueSum / weightSum
        }

        const y = height * scaleY - scaleY / 2
        const vIdx = (i * gridDim + j) * 3
        vertices[vIdx] = x
        vertices[vIdx + 1] = y
        vertices[vIdx + 2] = z
      }
    }

    // Grid triangles indices
    const indicesList: number[] = []
    for (let i = 0; i < gridDim - 1; i++) {
      for (let j = 0; j < gridDim - 1; j++) {
        const p0 = i * gridDim + j
        const p1 = (i + 1) * gridDim + j
        const p2 = i * gridDim + (j + 1)
        const p3 = (i + 1) * gridDim + (j + 1)

        indicesList.push(p0, p2, p1)
        indicesList.push(p1, p2, p3)
      }
    }
    const indices = new Uint32Array(indicesList)

    return { vertices, indices, normalizedTrials }
  }, [completedTrials, xKey, yKey, zKey])

  // Reference for updating vertex normals dynamically
  const geomRef = useRef<THREE.BufferGeometry>(null)
  useEffect(() => {
    if (
      geomRef.current &&
      typeof geomRef.current.computeVertexNormals === 'function' &&
      vertices.length > 0
    ) {
      geomRef.current.computeVertexNormals()
    }
  }, [vertices])

  // Active highlighted info card
  const activeDetailNumber = hoveredTrial !== null ? hoveredTrial : selectedTrialNumber
  const activeDetailTrial = useMemo(() => {
    if (activeDetailNumber === null) return null
    return completedTrials.find((t) => t.number === activeDetailNumber) || null
  }, [completedTrials, activeDetailNumber])

  const bestTrialNumber = results.best_trial?.number

  if (completedTrials.length === 0) {
    return (
      <div className="border-carbon-600/40 bg-carbon-900/10 text-silver-400 flex h-full w-full items-center justify-center rounded-xl border p-6 text-center text-sm">
        No completed trials available to render landscape.
      </div>
    )
  }

  return (
    <div className="border-carbon-800 bg-carbon-950/40 flex h-full w-full flex-col overflow-hidden rounded-xl border backdrop-blur-md md:flex-row">
      {/* Controls Sidebar */}
      <div className="border-carbon-800 bg-carbon-950/70 flex w-full shrink-0 flex-col gap-4 border-b p-4 md:w-64 md:border-r md:border-b-0">
        <div>
          <h3 className="text-silver-200 text-sm font-semibold tracking-wide uppercase">
            3D Landscape
          </h3>
          <p className="text-silver-500 mt-1 text-[11px]">
            Visualize parameters and objective metrics in real-time.
          </p>
        </div>

        <hr className="border-carbon-800" />

        {/* X Axis Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="x-axis-select" className="text-silver-400 text-xs font-medium">
            X Axis (Width)
          </label>
          <select
            id="x-axis-select"
            value={xKey}
            onChange={(e) => setXKey(e.target.value)}
            className="border-carbon-700 bg-carbon-900 text-silver-200 focus:ring-brass-500/50 rounded-lg border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
          >
            {parameterKeys.map((k) => (
              <option key={`x-${k}`} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {/* Y Axis Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="y-axis-select" className="text-silver-400 text-xs font-medium">
            Y Axis (Depth)
          </label>
          <select
            id="y-axis-select"
            value={yKey}
            onChange={(e) => setYKey(e.target.value)}
            className="border-carbon-700 bg-carbon-900 text-silver-200 focus:ring-brass-500/50 rounded-lg border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
          >
            {parameterKeys.map((k) => (
              <option key={`y-${k}`} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {/* Z Axis Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="z-axis-select" className="text-silver-400 text-xs font-medium">
            Z Axis (Height)
          </label>
          <select
            id="z-axis-select"
            value={zKey}
            onChange={(e) => setZKey(e.target.value)}
            className="border-carbon-700 bg-carbon-900 text-silver-200 focus:ring-brass-500/50 rounded-lg border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
          >
            <option value="objective">Primary Objective</option>
            {metricKeys.map((k) => (
              <option key={`z-${k}`} value={k}>
                Metric: {k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <hr className="border-carbon-800" />

        {/* Display Settings */}
        <div className="flex flex-col gap-2">
          <span className="text-silver-400 mb-1 text-xs font-medium">Display Settings</span>

          <button
            type="button"
            onClick={() => setShowWireframe(!showWireframe)}
            className="bg-carbon-900/50 hover:bg-carbon-900 hover:text-silver-200 text-silver-400 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors"
          >
            {showWireframe ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showWireframe ? 'Hide Wireframe Grid' : 'Show Wireframe Grid'}
          </button>

          <button
            type="button"
            onClick={() => setShowParticles(!showParticles)}
            className="bg-carbon-900/50 hover:bg-carbon-900 hover:text-silver-200 text-silver-400 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors"
          >
            <Sparkles className="text-brass-400 h-3.5 w-3.5" />
            {showParticles ? 'Hide Ambient Dust' : 'Show Ambient Dust'}
          </button>

          <button
            type="button"
            onClick={() => setResetCounter((prev) => prev + 1)}
            className="bg-carbon-900/50 hover:bg-carbon-900 hover:text-silver-200 text-silver-400 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset 3D Camera
          </button>
        </div>
      </div>

      {/* 3D Viewport Area */}
      <div className="from-carbon-950 to-carbon-900 relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b">
        <CanvasErrorBoundary
          fallback={
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-rose-400">
              WebGL is disabled or unsupported in your browser. Cannot display 3D Landscape.
            </div>
          }
        >
          <Canvas
            shadows
            camera={{ position: [16, 12, 16], fov: 45 }}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            gl={{ antialias: true }}
          >
            {/* Lights */}
            <ambientLight intensity={0.3} />
            <pointLight position={[18, 18, 18]} intensity={1.5} color="#fff8e7" castShadow />
            <spotLight
              position={[-18, 24, -18]}
              angle={0.3}
              penumbra={1}
              intensity={1}
              color="#ffd899"
              castShadow
            />
            <directionalLight position={[0, 18, 0]} intensity={0.4} color="#ffffff" />

            {/* Custom Procedural Terrain Mesh */}
            {vertices.length > 0 && (
              <group>
                {/* Solid surface */}
                <mesh castShadow receiveShadow>
                  <bufferGeometry ref={geomRef}>
                    <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
                    <bufferAttribute attach="index" args={[indices, 1]} />
                  </bufferGeometry>
                  <meshStandardMaterial
                    color="#141416"
                    roughness={0.8}
                    metalness={0.2}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {/* Wireframe overlay */}
                {showWireframe && (
                  <mesh position={[0, 0.005, 0]}>
                    <bufferGeometry>
                      <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
                      <bufferAttribute attach="index" args={[indices, 1]} />
                    </bufferGeometry>
                    <meshBasicMaterial
                      color="#c5a880"
                      wireframe={true}
                      transparent={true}
                      opacity={0.3}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                )}
              </group>
            )}

            {/* Floating Particles Dust */}
            {showParticles && <ParticleField />}

            {/* Trial Markers */}
            {normalizedTrials.map((nt) => {
              const isBest = nt.number === bestTrialNumber
              const isSelected = nt.number === selectedTrialNumber
              const isHovered = nt.number === hoveredTrial

              // Set sphere size and color based on state
              const size = isSelected ? 0.22 : isHovered ? 0.2 : isBest ? 0.16 : 0.12

              let markerColor = '#8e8e93' // Smoked Silver
              if (isSelected) {
                markerColor = '#ffd700' // Glowing selected yellow/brass
              } else if (isBest) {
                markerColor = '#d4af37' // Golden/Brass
              } else if (isHovered) {
                markerColor = '#ffd700'
              }

              return (
                <group key={`marker-${nt.number}`}>
                  {/* Sphere Marker */}
                  <mesh
                    position={[nt.x, nt.y, nt.z]}
                    data-testid={`trial-marker-${nt.number}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectTrial(nt.number === selectedTrialNumber ? null : nt.number)
                    }}
                    onPointerOver={(e) => {
                      e.stopPropagation()
                      setHoveredTrial(nt.number)
                      document.body.style.cursor = 'pointer'
                    }}
                    onPointerOut={() => {
                      setHoveredTrial(null)
                      document.body.style.cursor = 'auto'
                    }}
                  >
                    <sphereGeometry args={[size, 16, 16]} />
                    <meshStandardMaterial
                      color={markerColor}
                      roughness={0.2}
                      metalness={0.8}
                      emissive={isSelected || isHovered ? markerColor : '#000000'}
                      emissiveIntensity={isSelected || isHovered ? 0.4 : 0}
                    />
                  </mesh>

                  {/* Dropdown line projection to bottom plane (floor at y = -3) */}
                  {isSelected && (
                    <Line
                      points={[
                        [nt.x, -3, nt.z],
                        [nt.x, nt.y, nt.z],
                      ]}
                      color="#ffd700"
                      lineWidth={1.5}
                      dashed={true}
                      dashScale={6}
                      gapSize={0.15}
                      dashSize={0.15}
                    />
                  )}
                </group>
              )
            })}

            {/* Scene controls */}
            <SceneControls resetCounter={resetCounter} />
          </Canvas>
        </CanvasErrorBoundary>

        {/* Hover / Click Details HUD */}
        <div className="border-carbon-800 bg-carbon-950/80 pointer-events-none absolute top-4 right-4 z-10 max-w-sm rounded-lg border p-3.5 shadow-lg backdrop-blur-md">
          {activeDetailTrial ? (
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-silver-100 flex items-center gap-1 font-semibold">
                  Trial #{activeDetailTrial.number}
                  {activeDetailTrial.number === bestTrialNumber && (
                    <Trophy className="text-brass-400 fill-brass-400/20 h-3.5 w-3.5" />
                  )}
                </span>
                <span className="text-silver-400 bg-carbon-800 rounded px-1.5 py-0.5 text-[10px] capitalize">
                  {hoveredTrial === activeDetailTrial.number ? 'Hovered' : 'Selected'}
                </span>
              </div>

              <div className="border-carbon-800 my-1 border-t" />

              {/* Display primary parameter values */}
              <div className="text-silver-300 grid grid-cols-2 gap-x-4 gap-y-0.5">
                <span className="text-silver-500 font-medium">X ({xKey}):</span>
                <span className="text-silver-100 text-right font-mono">
                  {formatVal(activeDetailTrial.params[xKey])}
                </span>

                <span className="text-silver-500 font-medium">Y ({yKey}):</span>
                <span className="text-silver-100 text-right font-mono">
                  {formatVal(activeDetailTrial.params[yKey])}
                </span>
              </div>

              <div className="border-carbon-800 my-1 border-t" />

              {/* Display objective values & metrics */}
              <div className="text-silver-300 flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span className="text-silver-500 font-medium">Objective Value:</span>
                  <span className="text-brass-400 font-mono font-bold">
                    {activeDetailTrial.values?.map((v) => v.toFixed(4)).join(', ') || '—'}
                  </span>
                </div>
                {activeDetailTrial.user_attrs.metrics && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-silver-500 font-medium">Net Profit:</span>
                      <span className="text-silver-200 font-mono">
                        ${formatVal(activeDetailTrial.user_attrs.metrics.total_pnl)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-silver-500 font-medium">Sharpe Ratio:</span>
                      <span className="text-silver-200 font-mono">
                        {formatVal(activeDetailTrial.user_attrs.metrics.sharpe_ratio)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-silver-500 font-medium">Max Drawdown:</span>
                      <span className="font-mono text-rose-400">
                        {formatVal(activeDetailTrial.user_attrs.metrics.max_drawdown_pct)}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-silver-400 flex max-w-[200px] items-start gap-2 text-[11px]">
              <HelpCircle className="text-silver-500 h-4 w-4 shrink-0" />
              <span>
                Click or hover on a 3D sphere marker to inspect trial details. Drag to rotate
                terrain.
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-carbon-950/80 text-silver-400 border-carbon-800 absolute bottom-4 left-4 z-10 flex gap-4 rounded-md border px-3 py-2 text-[10px] shadow backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#8e8e93]" />
            <span>Completed Trial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#d4af37]" />
            <span>Best Trial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#ffd700]" />
            <span>Selected Trial</span>
          </div>
        </div>
      </div>
    </div>
  )
}
