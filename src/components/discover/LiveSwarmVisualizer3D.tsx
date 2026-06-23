import React, { useMemo, useState, useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'
import { RotateCcw, Trophy, HelpCircle, Sliders, Play } from 'lucide-react'
import type {
  StrategySearchStatus,
  StrategySearchResults,
  CandidateResult,
} from '@/types/strategySearch'
import { formatObjectiveMetricValue, objectiveMetricLabel } from '@/lib/walkforward/objectiveMetric'
import { registerFeature3DSurface } from '@/lib/cinematic/feature3DRegistry'

// WebGL Error Boundary
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
    console.error('WebGL Swarm Canvas Error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Scene controls camera reset handler
function SceneControls({ resetCounter }: { resetCounter: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()

  useEffect(() => {
    if (resetCounter > 0 && controlsRef.current) {
      camera.position.set(0, 10, 16)
      camera.lookAt(0, 0, 0)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [resetCounter, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={35}
    />
  )
}

// Type definitions for simulated swarm particles
interface SimulatedParticle {
  id: number
  position: THREE.Vector3
  driftPhase: number
  speed: number
  color: THREE.Color
  size: number
  isDying: boolean
  isNew: boolean
  mutationTimer: number
  crossoverPartnerId: number | null
}

// Helper: Generate a color based on fitness value
function getFitnessColor(fitness: number, opacity = 1): string {
  if (fitness < 0.3) {
    return `rgba(111, 119, 133, ${opacity})` // grey/silver
  }
  if (fitness < 0.6) {
    return `rgba(184, 131, 28, ${opacity})` // brass-600
  }
  if (fitness < 0.85) {
    return `rgba(240, 180, 41, ${opacity})` // brass-400
  }
  return `rgba(255, 202, 71, ${opacity})` // gold-400
}

// ==========================================
// 1. RUNNING MODE: Simulated Swarm Component
// ==========================================
function SimulatedSwarm({
  generation,
  populationSize = 40,
}: {
  generation: number
  populationSize?: number
}) {
  const [particles, setParticles] = useState<SimulatedParticle[]>([])
  const prevGeneration = useRef(generation)

  // Initialize particles
  useEffect(() => {
    const list: SimulatedParticle[] = []
    for (let i = 0; i < populationSize; i++) {
      list.push({
        id: i,
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 14,
        ),
        driftPhase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.4,
        color: new THREE.Color().setStyle(getFitnessColor(Math.random())),
        size: 0.12 + Math.random() * 0.08,
        isDying: false,
        isNew: false,
        mutationTimer: 0,
        crossoverPartnerId: null,
      })
    }
    setParticles(list)
  }, [populationSize])

  // Handle generation change trigger (Natural selection, Crossover, Mutation animations)
  useEffect(() => {
    if (generation > prevGeneration.current && particles.length > 0) {
      prevGeneration.current = generation

      setParticles((prev) => {
        return prev.map((p) => {
          const rand = Math.random()
          // 30% chance to die (Selection)
          if (rand < 0.3) {
            return { ...p, isDying: true }
          }
          // 15% chance to mutate (Mutation)
          if (rand > 0.85) {
            return {
              ...p,
              mutationTimer: 1.5,
              color: new THREE.Color('#a855f7'),
            }
          }
          // 40% chance to crossover
          if (rand > 0.45 && rand <= 0.85) {
            const partners = prev.filter((o) => o.id !== p.id && !o.isDying)
            const partner = partners[Math.floor(Math.random() * partners.length)]
            return { ...p, crossoverPartnerId: partner ? partner.id : null }
          }

          return p
        })
      })

      // Clean up dying and spawn replacements
      const timer = setTimeout(() => {
        setParticles((prev) => {
          const survivors = prev
            .filter((p) => !p.isDying)
            .map((p) => ({
              ...p,
              crossoverPartnerId: null,
              color:
                p.mutationTimer <= 0
                  ? new THREE.Color().setStyle(getFitnessColor(Math.random()))
                  : p.color,
            }))

          const replacementsNeeded = populationSize - survivors.length
          const replacements: SimulatedParticle[] = []

          for (let i = 0; i < replacementsNeeded; i++) {
            replacements.push({
              id: Date.now() + i,
              position: new THREE.Vector3(
                (Math.random() - 0.5) * 14,
                -4,
                (Math.random() - 0.5) * 14,
              ),
              driftPhase: Math.random() * Math.PI * 2,
              speed: 0.2 + Math.random() * 0.4,
              color: new THREE.Color().setStyle(getFitnessColor(Math.random())),
              size: 0.12 + Math.random() * 0.08,
              isDying: false,
              isNew: true,
              mutationTimer: 0,
              crossoverPartnerId: null,
            })
          }

          return [...survivors, ...replacements]
        })
      }, 800)

      return () => clearTimeout(timer)
    }
  }, [generation, particles.length, populationSize])

  // Swarm drift loop animation
  useFrame((state, delta) => {
    setParticles((prev) =>
      prev.map((p) => {
        const time = state.clock.elapsedTime
        const nextPos = p.position.clone()

        if (p.isDying) {
          nextPos.y -= delta * 3
        } else if (p.isNew) {
          nextPos.y += delta * 2
          if (nextPos.y >= -2) {
            p.isNew = false
          }
        } else {
          nextPos.x += Math.sin(time * p.speed + p.driftPhase) * 0.02
          nextPos.y += Math.cos(time * p.speed + p.driftPhase) * 0.01
          nextPos.z += Math.sin(time * p.speed * 0.8 + p.driftPhase) * 0.02

          nextPos.x = Math.max(-7.5, Math.min(7.5, nextPos.x))
          nextPos.y = Math.max(-3.5, Math.min(3.5, nextPos.y))
          nextPos.z = Math.max(-7.5, Math.min(7.5, nextPos.z))
        }

        let mutTimer = p.mutationTimer
        let col = p.color
        if (p.mutationTimer > 0) {
          mutTimer -= delta
          if (mutTimer <= 0) {
            col = new THREE.Color().setStyle(getFitnessColor(Math.random()))
          }
        }

        return {
          ...p,
          position: nextPos,
          mutationTimer: mutTimer,
          color: col,
        }
      }),
    )
  })

  const crossoverLines = useMemo(() => {
    const lines: Array<{ start: THREE.Vector3; end: THREE.Vector3; id: string }> = []
    particles.forEach((p) => {
      if (p.crossoverPartnerId !== null) {
        const partner = particles.find((o) => o.id === p.crossoverPartnerId)
        if (partner) {
          lines.push({
            start: p.position,
            end: partner.position,
            id: `${p.id}-${partner.id}`,
          })
        }
      }
    })
    return lines
  }, [particles])

  return (
    <group>
      {particles.map((p) => (
        <mesh key={p.id} position={p.position}>
          <sphereGeometry args={[p.size, 12, 12]} />
          <meshStandardMaterial
            color={p.color}
            roughness={0.2}
            metalness={0.8}
            emissive={p.mutationTimer > 0 ? '#a855f7' : p.color}
            emissiveIntensity={p.mutationTimer > 0 ? 0.6 : 0.15}
          />
        </mesh>
      ))}

      {crossoverLines.map((line) => (
        <Line
          key={line.id}
          points={[
            [line.start.x, line.start.y, line.start.z],
            [line.end.x, line.end.y, line.end.z],
          ]}
          color="#ffd700"
          lineWidth={1.2}
          transparent
          opacity={0.4}
        />
      ))}
    </group>
  )
}

// ==========================================
// 2. COMPLETED MODE: Static Trial Map Component
// ==========================================
type ZAxisMetric = 'complexity' | 'robustness' | 'efficiency'

type CompletedSwarmProps = {
  candidates: CandidateResult[]
  bestCandidateId: string | null
  zMetric: ZAxisMetric
  hoveredTrial: string | null
  setHoveredTrial: (id: string | null) => void
  selectedTrial: string | null
  setSelectedTrial: (id: string | null) => void
}

function CompletedSwarm({
  candidates,
  bestCandidateId,
  zMetric,
  hoveredTrial,
  setHoveredTrial,
  selectedTrial,
  setSelectedTrial,
}: CompletedSwarmProps) {
  const validCandidates = useMemo(
    () => candidates.filter((c) => c.status === 'completed' && c.generation != null),
    [candidates],
  )

  const bounds = useMemo(() => {
    const generations = validCandidates.map((c) => c.generation!)
    const objectives = validCandidates.map((c) => c.objective_value ?? 0)
    const zVals = validCandidates.map((c) => {
      if (zMetric === 'complexity') return c.genome_node_count ?? 0
      if (zMetric === 'robustness') return c.robustness_score ?? 0
      return c.efficiency ?? 0
    })

    return {
      gMin: Math.min(...generations, 0),
      gMax: Math.max(...generations, 1),
      oMin: Math.min(...objectives, 0),
      oMax: Math.max(...objectives, 1),
      zMin: Math.min(...zVals, 0),
      zMax: Math.max(...zVals, 1),
    }
  }, [validCandidates, zMetric])

  const mappedPoints = useMemo(() => {
    const { gMin, gMax, oMin, oMax, zMin, zMax } = bounds
    const gRange = gMax - gMin || 1
    const oRange = oMax - oMin || 1
    const zRange = zMax - zMin || 1

    return validCandidates.map((c) => {
      const gNormalized = (c.generation! - gMin) / gRange
      const oNormalized = ((c.objective_value ?? 0) - oMin) / oRange
      const zVal =
        zMetric === 'complexity'
          ? (c.genome_node_count ?? 0)
          : zMetric === 'robustness'
            ? (c.robustness_score ?? 0)
            : (c.efficiency ?? 0)
      const zNormalized = (zVal - zMin) / zRange

      return {
        candidate_id: c.candidate_id,
        x: gNormalized * 15 - 7.5,
        y: oNormalized * 7 - 3.5,
        z: zNormalized * 15 - 7.5,
        originalObj: c.objective_value ?? 0,
        originalGen: c.generation!,
        originalZVal: zVal,
        isBest: c.candidate_id === bestCandidateId,
        color: new THREE.Color().setStyle(getFitnessColor(oNormalized)),
        raw: c,
      }
    })
  }, [validCandidates, bounds, zMetric, bestCandidateId])

  const lineageLines = useMemo(() => {
    if (!hoveredTrial) return []
    const hoveredNode = mappedPoints.find((p) => p.candidate_id === hoveredTrial)
    if (!hoveredNode || !hoveredNode.raw.genome?.metadata?.parent_ids) return []

    const parentIds = hoveredNode.raw.genome.metadata.parent_ids
    const lines: Array<[[number, number, number], [number, number, number]]> = []

    parentIds.forEach((pId) => {
      const parentNode = mappedPoints.find((p) => p.candidate_id === pId)
      if (parentNode) {
        lines.push([
          [hoveredNode.x, hoveredNode.y, hoveredNode.z],
          [parentNode.x, parentNode.y, parentNode.z],
        ])
      }
    })
    return lines
  }, [hoveredTrial, mappedPoints])

  return (
    <group>
      {mappedPoints.map((pt) => {
        const isHovered = pt.candidate_id === hoveredTrial
        const isSelected = pt.candidate_id === selectedTrial
        const size = isSelected ? 0.28 : isHovered ? 0.24 : pt.isBest ? 0.2 : 0.14
        let color = pt.color

        if (isSelected) {
          color = new THREE.Color('#ffd700')
        } else if (pt.isBest) {
          color = new THREE.Color('#f0b429')
        } else if (isHovered) {
          color = new THREE.Color('#ffdca0')
        }

        return (
          <group key={pt.candidate_id}>
            <mesh
              position={[pt.x, pt.y, pt.z]}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedTrial(pt.candidate_id === selectedTrial ? null : pt.candidate_id)
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHoveredTrial(pt.candidate_id)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                setHoveredTrial(null)
                document.body.style.cursor = 'auto'
              }}
            >
              <sphereGeometry args={[size, 16, 16]} />
              <meshStandardMaterial
                color={color}
                roughness={0.2}
                metalness={0.8}
                emissive={isSelected || isHovered ? color : '#000000'}
                emissiveIntensity={isSelected || isHovered ? 0.4 : 0}
              />
            </mesh>

            {(isSelected || isHovered) && (
              <Line
                points={[
                  [pt.x, -3.5, pt.z],
                  [pt.x, pt.y, pt.z],
                ]}
                color="#f0b429"
                lineWidth={1}
                dashed
                dashScale={8}
                gapSize={0.12}
                dashSize={0.12}
              />
            )}
          </group>
        )
      })}

      {lineageLines.map((pts, idx) => (
        <Line key={`line-${idx}`} points={pts} color="#34d399" lineWidth={1.5} />
      ))}
    </group>
  )
}

// ==========================================
// 3. MAIN CONTAINER VISUALIZER COMPONENT
// ==========================================
export type LiveSwarmVisualizer3DProps = {
  status: StrategySearchStatus | undefined
  results: StrategySearchResults | undefined
  isRunning: boolean
  selectedTrialId?: string | null
  onSelectTrialId?: (id: string | null) => void
}

export function LiveSwarmVisualizer3D({
  status,
  results,
  isRunning,
  selectedTrialId = null,
  onSelectTrialId,
}: LiveSwarmVisualizer3DProps) {
  useEffect(() => registerFeature3DSurface('discover-swarm'), [])

  const [resetCounter, setResetCounter] = useState(0)
  const [zMetric, setZMetric] = useState<ZAxisMetric>('complexity')

  const [localHover, setLocalHover] = useState<string | null>(null)
  const [localSelected, setLocalSelected] = useState<string | null>(null)

  const activeSelected = onSelectTrialId ? selectedTrialId : localSelected
  const setActiveSelected = (id: string | null) => {
    if (onSelectTrialId) {
      onSelectTrialId(id)
    } else {
      setLocalSelected(id)
    }
  }

  const activeDetailId = localHover || activeSelected
  const candidatesList = results?.candidates ?? []
  const activeDetailCandidate = useMemo(() => {
    if (!activeDetailId) return null
    return candidatesList.find((c) => c.candidate_id === activeDetailId) || null
  }, [candidatesList, activeDetailId])

  const objectiveMode = results?.objective_mode ?? 'maximize_sharpe'
  const popSize = status?.search_config?.genetic?.population_size ?? 40
  const genNum = status?.generation ?? 0

  return (
    <div className="surface-panel border-carbon-800 relative flex h-[480px] w-full flex-col overflow-hidden rounded-xl border md:flex-row">
      <div className="from-carbon-950 to-carbon-900 relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b">
        <CanvasErrorBoundary
          fallback={
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-rose-400">
              WebGL is unsupported or disabled in your browser. Live Swarm cannot load.
            </div>
          }
        >
          <Canvas
            camera={{ position: [0, 10, 16], fov: 45 }}
            className="h-full w-full cursor-grab active:cursor-grabbing"
          >
            <ambientLight intensity={0.4} />
            <pointLight position={[15, 15, 15]} intensity={1.2} color="#fff8e7" />
            <spotLight
              position={[-15, 20, -15]}
              angle={0.3}
              penumbra={1}
              intensity={0.8}
              color="#ffd899"
            />
            <directionalLight position={[0, 10, 0]} intensity={0.3} />

            <gridHelper args={[16, 16, '#c5a880', '#22262c']} position={[0, -3.5, 0]} />
            <gridHelper args={[16, 16, '#22262c', '#181b1f']} position={[0, 3.5, 0]} />

            <Line
              points={[
                [-8, -3.5, -8],
                [-8, 3.5, -8],
              ]}
              color="rgba(168, 139, 82, 0.15)"
              lineWidth={1}
            />
            <Line
              points={[
                [8, -3.5, -8],
                [8, 3.5, -8],
              ]}
              color="rgba(168, 139, 82, 0.15)"
              lineWidth={1}
            />
            <Line
              points={[
                [-8, -3.5, 8],
                [-8, 3.5, 8],
              ]}
              color="rgba(168, 139, 82, 0.15)"
              lineWidth={1}
            />
            <Line
              points={[
                [8, -3.5, 8],
                [8, 3.5, 8],
              ]}
              color="rgba(168, 139, 82, 0.15)"
              lineWidth={1}
            />

            {isRunning ? (
              <SimulatedSwarm generation={genNum} populationSize={popSize} />
            ) : (
              <CompletedSwarm
                candidates={candidatesList}
                bestCandidateId={results?.summary?.best_candidate_id ?? null}
                zMetric={zMetric}
                hoveredTrial={localHover}
                setHoveredTrial={setLocalHover}
                selectedTrial={activeSelected}
                setSelectedTrial={setActiveSelected}
              />
            )}

            <SceneControls resetCounter={resetCounter} />
          </Canvas>
        </CanvasErrorBoundary>

        {isRunning && (
          <div className="surface-float surface-float--blur absolute top-4 left-4 z-10 flex flex-col gap-1 rounded-lg px-3 py-2 text-xs">
            <span className="text-brass-400 flex items-center gap-1.5 font-bold tracking-wider uppercase">
              <span className="live-status-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live GA Swarm
            </span>
            <span className="text-silver-300">
              Gen: <span className="text-silver-100 font-mono font-bold">{genNum}</span>
            </span>
            <span className="text-silver-300">
              Pop Size: <span className="text-silver-100 font-mono font-bold">{popSize}</span>
            </span>
          </div>
        )}

        {!isRunning && activeDetailCandidate && (
          <div className="surface-float surface-float--blur absolute top-4 right-4 z-10 w-64 rounded-lg p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-silver-100 truncate font-bold">
                {activeDetailCandidate.strategy.replace(/Strategy$/, '')}
              </span>
              {activeDetailCandidate.candidate_id === results?.summary?.best_candidate_id && (
                <Trophy className="text-brass-400 fill-brass-400/20 h-4 w-4 shrink-0" />
              )}
            </div>
            <p className="text-silver-500 mt-0.5 truncate font-mono text-[9px]">
              ID: {activeDetailCandidate.candidate_id.slice(0, 8)}...
            </p>

            <hr className="border-carbon-800 my-2" />

            <div className="text-silver-300 grid grid-cols-2 gap-y-1.5">
              <span className="text-silver-500 font-semibold">Gen Born:</span>
              <span className="text-silver-100 text-right font-mono font-semibold">
                {activeDetailCandidate.generation ?? 0}
              </span>

              <span className="text-silver-500 font-semibold">Objective Val:</span>
              <span className="text-brass-400 text-right font-mono font-bold">
                {formatObjectiveMetricValue(activeDetailCandidate.objective_value, objectiveMode)}
              </span>

              <span className="text-silver-500 font-semibold">Robustness:</span>
              <span className="text-silver-100 text-right font-mono">
                {activeDetailCandidate.robustness_score?.toFixed(2) ?? '—'}
              </span>

              <span className="text-silver-500 font-semibold">Node Complexity:</span>
              <span className="text-silver-100 text-right font-mono">
                {activeDetailCandidate.genome_node_count ?? 0} nodes
              </span>

              {activeDetailCandidate.oos_metrics?.win_rate != null && (
                <>
                  <span className="text-silver-500 font-semibold">OOS Win Rate:</span>
                  <span className="text-silver-100 text-right font-mono">
                    {(activeDetailCandidate.oos_metrics.win_rate * 100).toFixed(1)}%
                  </span>
                </>
              )}
            </div>

            {activeDetailCandidate.genome?.metadata?.parent_ids && (
              <div className="text-silver-400 mt-2 text-[10px] italic">
                * Green lines highlight lineage to parents
              </div>
            )}
          </div>
        )}

        {!isRunning && !activeDetailCandidate && (
          <div className="surface-float surface-float--blur text-silver-400 absolute top-4 right-4 z-10 flex max-w-[220px] gap-1.5 rounded-lg p-3 text-[11px]">
            <HelpCircle className="text-silver-500 mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Hover or click on candidate nodes to trace lineage, examine performance details, or
              select for review.
            </span>
          </div>
        )}

        <div className="surface-float text-silver-400 border-carbon-800 absolute bottom-4 left-4 z-10 flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg px-3 py-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#6f7785]" />
            <span>Low Fitness</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#b8831c]" />
            <span>Avg Fitness</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#f0b429]" />
            <span>High Fitness</span>
          </div>
          {!isRunning && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-[#ffd700] shadow-[0_0_8px_rgba(255,215,0,0.6)]" />
                <span>Selected Node</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-4 rounded-full bg-[#34d399]" />
                <span>Lineage Wire</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-carbon-800 bg-carbon-950/75 flex w-full shrink-0 flex-col gap-4 border-t p-4 md:w-60 md:border-t-0 md:border-l">
        <div>
          <h3 className="text-silver-200 flex items-center gap-1.5 text-sm font-semibold tracking-wide uppercase">
            <Sliders className="text-brass-400 h-4 w-4" />
            Swarm Control
          </h3>
          <p className="text-silver-500 mt-1 text-[11px]">
            {isRunning
              ? 'Monitoring live generation mutation structures.'
              : 'Examine strategy population distribution and lineage.'}
          </p>
        </div>

        <hr className="border-carbon-800" />

        {!isRunning ? (
          <div className="flex flex-col gap-2.5">
            <label htmlFor="z-metric-select" className="text-silver-400 text-xs font-semibold">
              Z Axis (Depth)
            </label>
            <select
              id="z-metric-select"
              value={zMetric}
              onChange={(e) => setZMetric(e.target.value as ZAxisMetric)}
              className="border-carbon-700 bg-carbon-900 text-silver-200 focus:ring-brass-500/50 rounded-lg border px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
            >
              <option value="complexity">Node Complexity (Count)</option>
              <option value="robustness">Robustness Score</option>
              <option value="efficiency">Out-of-sample Efficiency</option>
            </select>

            <div className="text-silver-400 mt-1 space-y-1.5 text-[11px]">
              <p>
                <strong>X-Axis (Width)</strong>: Generation born
              </p>
              <p>
                <strong>Y-Axis (Height)</strong>: IS {objectiveMetricLabel(objectiveMode)}
              </p>
            </div>
          </div>
        ) : (
          <div className="border-carbon-800 bg-carbon-900/30 flex flex-col gap-2.5 rounded-lg border p-3">
            <div className="text-silver-300 flex items-center gap-1.5 text-xs font-medium">
              <Play className="h-3 w-3 animate-pulse fill-emerald-400/20 text-emerald-400" />
              Evolution Active
            </div>
            <p className="text-silver-500 text-[10px] leading-relaxed">
              Selection wipes out weaker nodes, crossover joins parents, and mutation flashes purple
              nodes with sparks.
            </p>
          </div>
        )}

        <hr className="border-carbon-800 mt-auto" />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setResetCounter((prev) => prev + 1)}
            className="bg-carbon-900/60 hover:bg-carbon-800 hover:text-silver-100 border-carbon-700/60 text-silver-300 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all duration-200 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset 3D Camera
          </button>
        </div>
      </div>
    </div>
  )
}
