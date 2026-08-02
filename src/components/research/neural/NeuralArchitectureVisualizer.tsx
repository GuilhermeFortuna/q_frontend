import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlowCard } from '@/components/ui/spotlight-card'

type Node = {
  id: string
  x: number
  y: number
  layer: 'input' | 'latent' | 'output'
  label: string
  activation: number
  simulatedHistory: number[]
}

type Connection = {
  from: Node
  to: Node
  weight: number
}

type Particle = {
  fromNode: Node
  toNode: Node
  progress: number
  speed: number
  color: string
}

export function NeuralArchitectureVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [animationMode, setAnimationMode] = useState<'flow' | 'noise' | 'train'>('flow')
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [focusedNode, setFocusedNode] = useState<Node | null>(null)
  const [loss, setLoss] = useState(0.042)
  const [epoch, setEpoch] = useState(128)

  // Setup layers
  const nodesRef = useRef<Node[]>([])
  const connectionsRef = useRef<Connection[]>([])
  const particlesRef = useRef<Particle[]>([])

  // Initialize network nodes and connections once
  const initNetwork = (width: number, height: number) => {
    const nodes: Node[] = []
    const paddingX = 45
    const paddingY = 25
    const drawWidth = width - paddingX * 2
    const drawHeight = height - paddingY * 2

    const inputLabels = ['Close', 'Vol', 'RSI', 'MACD']
    const latentLabels = ['z_0', 'z_1']
    const outputLabels = ["Close'", "Vol'", "RSI'", "MACD'"]

    // Input Layer (4 nodes)
    for (let i = 0; i < 4; i++) {
      nodes.push({
        id: `in-${i}`,
        x: paddingX,
        y: paddingY + (drawHeight / 3) * i,
        layer: 'input',
        label: inputLabels[i],
        activation: 0.5 + Math.sin(i) * 0.4,
        simulatedHistory: Array.from({ length: 15 }, (_, idx) => 0.4 + Math.sin(idx / 2 + i) * 0.3),
      })
    }

    // Latent Layer (2 nodes)
    for (let i = 0; i < 2; i++) {
      nodes.push({
        id: `latent-${i}`,
        x: paddingX + drawWidth / 2,
        y: paddingY + drawHeight / 3 + (drawHeight / 3) * i * 1.3,
        layer: 'latent',
        label: latentLabels[i],
        activation: 0.2 + Math.cos(i) * 0.5,
        simulatedHistory: Array.from({ length: 15 }, (_, idx) => 0.2 + Math.cos(idx / 3 + i) * 0.4),
      })
    }

    // Output Layer (4 nodes)
    for (let i = 0; i < 4; i++) {
      nodes.push({
        id: `out-${i}`,
        x: paddingX + drawWidth,
        y: paddingY + (drawHeight / 3) * i,
        layer: 'output',
        label: outputLabels[i],
        activation: 0.4 + Math.sin(i + 1) * 0.3,
        simulatedHistory: Array.from(
          { length: 15 },
          (_, idx) => 0.35 + Math.sin(idx / 2 + i + 1) * 0.25,
        ),
      })
    }

    nodesRef.current = nodes

    // Build connections
    const connections: Connection[] = []
    const inputs = nodes.filter((n) => n.layer === 'input')
    const latents = nodes.filter((n) => n.layer === 'latent')
    const outputs = nodes.filter((n) => n.layer === 'output')

    // Input to Latent
    inputs.forEach((inNode) => {
      latents.forEach((latNode) => {
        connections.push({
          from: inNode,
          to: latNode,
          weight: Math.random() * 2 - 1,
        })
      })
    })

    // Latent to Output
    latents.forEach((latNode) => {
      outputs.forEach((outNode) => {
        connections.push({
          from: latNode,
          to: outNode,
          weight: Math.random() * 2 - 1,
        })
      })
    })

    connectionsRef.current = connections
  }

  // Handle canvas sizing and animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set layout dimensions
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      initNetwork(rect.width, rect.height)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    let animationId: number
    let trainTick = 0

    // Animation Loop
    const render = () => {
      const width = canvas.width / window.devicePixelRatio
      const height = canvas.height / window.devicePixelRatio
      ctx.clearRect(0, 0, width, height)

      // 1. Draw Connections (Weights)
      connectionsRef.current.forEach((conn) => {
        const isHoverPath =
          hoveredNode && (conn.from.id === hoveredNode.id || conn.to.id === hoveredNode.id)
        const isFocusedPath =
          focusedNode && (conn.from.id === focusedNode.id || conn.to.id === focusedNode.id)

        ctx.beginPath()
        ctx.moveTo(conn.from.x, conn.from.y)
        ctx.lineTo(conn.to.x, conn.to.y)

        // Draw style based on state
        if (isFocusedPath) {
          ctx.strokeStyle = 'rgba(196, 165, 116, 0.65)' // focused brass glow
          ctx.lineWidth = 2
        } else if (isHoverPath) {
          ctx.strokeStyle = 'rgba(196, 165, 116, 0.45)' // hover brass glow
          ctx.lineWidth = 1.5
        } else {
          // positive/negative weight shading
          ctx.strokeStyle = conn.weight > 0 ? 'rgba(163, 230, 53, 0.08)' : 'rgba(244, 63, 94, 0.08)'
          ctx.lineWidth = 1 + Math.abs(conn.weight) * 0.8
        }
        ctx.stroke()
      })

      // 2. Spawn and update particles
      // Spawn rate based on mode
      const spawnRate = animationMode === 'noise' ? 0.08 : 0.04
      if (Math.random() < spawnRate && connectionsRef.current.length > 0) {
        const conn =
          connectionsRef.current[Math.floor(Math.random() * connectionsRef.current.length)]
        let particleColor = 'rgba(196, 165, 116, 0.6)'
        if (animationMode === 'noise') {
          particleColor = Math.random() > 0.5 ? 'rgba(244, 63, 94, 0.8)' : 'rgba(56, 189, 248, 0.8)'
        } else if (animationMode === 'train') {
          particleColor = 'rgba(16, 185, 129, 0.8)' // green convergence pulses
        }

        particlesRef.current.push({
          fromNode: conn.from,
          toNode: conn.to,
          progress: 0,
          speed: 0.015 + Math.random() * 0.015,
          color: particleColor,
        })
      }

      // Render & update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.progress += p.speed
        if (p.progress >= 1) {
          // Trigger slight node ripple activation on target node
          p.toNode.activation = Math.min(1, p.toNode.activation + 0.05)
          return false
        }

        const currX = p.fromNode.x + (p.toNode.x - p.fromNode.x) * p.progress
        const currY = p.fromNode.y + (p.toNode.y - p.fromNode.y) * p.progress

        ctx.beginPath()
        ctx.arc(currX, currY, 2, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 4
        ctx.fill()
        ctx.shadowBlur = 0 // reset shadow
        return true
      })

      // 3. Draw Nodes
      nodesRef.current.forEach((node) => {
        const isHovered = hoveredNode?.id === node.id
        const isFocused = focusedNode?.id === node.id

        // Node Glow Ring
        ctx.beginPath()
        ctx.arc(node.x, node.y, 8, 0, Math.PI * 2)
        if (isFocused) {
          ctx.fillStyle = '#0a0a0a'
          ctx.strokeStyle = '#c4a574' // brass border
          ctx.lineWidth = 2.5
        } else if (isHovered) {
          ctx.fillStyle = '#171717'
          ctx.strokeStyle = 'rgba(196, 165, 116, 0.8)'
          ctx.lineWidth = 2
        } else {
          ctx.fillStyle = '#0a0a0a'
          ctx.strokeStyle =
            node.layer === 'latent' ? 'rgba(196, 165, 116, 0.45)' : 'rgba(82, 82, 82, 0.5)'
          ctx.lineWidth = 1.5
        }
        ctx.fill()
        ctx.stroke()

        // Inner glowing core representing activation level
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        let coreColor = 'rgba(196, 165, 116, 0.3)'
        if (node.layer === 'input')
          coreColor = 'rgba(163, 230, 53, 0.5)' // Input: green
        else if (node.layer === 'latent')
          coreColor = 'rgba(234, 179, 8, 0.7)' // Latent: yellow
        else coreColor = 'rgba(56, 189, 248, 0.5)' // Output: blue

        ctx.fillStyle = coreColor
        ctx.shadowColor = coreColor
        ctx.shadowBlur = isHovered || isFocused ? 8 : 2
        ctx.fill()
        ctx.shadowBlur = 0

        // Labels
        ctx.fillStyle = isFocused ? '#e5e5e5' : isHovered ? '#c4a574' : '#a3a3a3'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign =
          node.layer === 'output' ? 'left' : node.layer === 'input' ? 'right' : 'center'

        const textOffset = node.layer === 'output' ? 14 : node.layer === 'input' ? -14 : 0
        const textY = node.layer === 'latent' ? node.y - 14 : node.y + 3
        ctx.fillText(node.label, node.x + textOffset, textY)

        // decay node activation slowly over time
        node.activation = Math.max(0.1, node.activation - 0.005)
      })

      // 4. Update training metrics if in "train" mode
      if (animationMode === 'train') {
        trainTick++
        if (trainTick % 25 === 0) {
          setLoss((prev) => Math.max(0.008, prev - 0.001 * Math.random()))
          setEpoch((prev) => prev + 1)
        }
      }

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [animationMode, hoveredNode, focusedNode])

  // Canvas interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find closest node
    let closest: Node | null = null
    let minDist = 18

    nodesRef.current.forEach((node) => {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
      if (dist < minDist) {
        minDist = dist
        closest = node
      }
    })

    setHoveredNode(closest)
  }

  const handleMouseLeave = () => {
    setHoveredNode(null)
  }

  const handleCanvasClick = () => {
    if (hoveredNode) {
      setFocusedNode(hoveredNode)
    } else {
      setFocusedNode(null)
    }
  }

  const handleResetTrain = () => {
    setLoss(0.042)
    setEpoch(128)
  }

  return (
    <div
      className="surface-well border-carbon-700/60 relative flex flex-col gap-3 overflow-hidden rounded-xl border p-3.5"
      ref={containerRef}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-brass-400 flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
            <Activity className="text-brass-400 h-3 w-3" />
            Encoder Flow Visualizer
          </span>
          <span className="text-silver-500 font-mono text-[9px]">
            Click nodes to inspect activation weights
          </span>
        </div>

        {/* Mode Selector */}
        <div className="bg-carbon-950/70 border-carbon-800/80 flex rounded-lg border p-0.5 font-mono text-[9px]">
          <button
            onClick={() => {
              setAnimationMode('flow')
              handleResetTrain()
            }}
            className={`rounded px-2 py-0.5 ${
              animationMode === 'flow'
                ? 'bg-brass-500/10 text-brass-400 font-semibold'
                : 'text-silver-400 hover:text-silver-200'
            }`}
          >
            Flow
          </button>
          <button
            onClick={() => {
              setAnimationMode('noise')
              handleResetTrain()
            }}
            className={`rounded px-2 py-0.5 ${
              animationMode === 'noise'
                ? 'bg-brass-500/10 text-brass-400 font-semibold'
                : 'text-silver-400 hover:text-silver-200'
            }`}
          >
            Noise
          </button>
          <button
            onClick={() => setAnimationMode('train')}
            className={`rounded px-2 py-0.5 ${
              animationMode === 'train'
                ? 'bg-brass-500/10 text-brass-400 font-semibold'
                : 'text-silver-400 hover:text-silver-200'
            }`}
          >
            Train
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="border-carbon-800/40 relative h-44 w-full rounded-lg border bg-black/20">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          className="absolute inset-0 h-full w-full cursor-crosshair"
        />

        {/* Hover / Node Overlay Info */}
        {hoveredNode && (
          <div
            className="bg-carbon-950/95 border-brass-500/20 text-silver-100 pointer-events-none absolute z-10 flex flex-col gap-1 rounded-lg border p-2 font-mono text-[9px] shadow-lg"
            style={{
              left: `${Math.min(hoveredNode.x + 12, (canvasRef.current?.width ?? 0) / window.devicePixelRatio - 140)}px`,
              top: `${Math.min(hoveredNode.y - 12, (canvasRef.current?.height ?? 0) / window.devicePixelRatio - 70)}px`,
            }}
          >
            <div className="text-brass-400 border-carbon-800 border-b pb-0.5 font-bold">
              Node: {hoveredNode.label}
            </div>
            <div>Layer: {hoveredNode.layer.toUpperCase()}</div>
            <div>Activation: {hoveredNode.activation.toFixed(3)}</div>
          </div>
        )}
      </div>

      {/* Detail Inspector Card */}
      {focusedNode ? (
        <div className="bg-carbon-950/70 border-carbon-800/80 flex flex-col gap-1.5 rounded-lg border p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-brass-400 font-mono text-[10px] font-bold">
              INSPECTING: {focusedNode.label}
            </span>
            <button
              onClick={() => setFocusedNode(null)}
              className="text-silver-500 hover:text-silver-300 font-mono text-[9px]"
            >
              Close
            </button>
          </div>
          <div className="text-silver-300 grid grid-cols-2 gap-2 font-mono text-[10px]">
            <GlowCard intensity="tile" className="rounded p-1.5">
              <span className="text-silver-500 block text-[9px]">ACTIVATION</span>
              <span className="text-sm font-semibold tabular-nums">
                {focusedNode.activation.toFixed(4)}
              </span>
            </GlowCard>
            <GlowCard intensity="tile" className="rounded p-1.5">
              <span className="text-silver-500 block text-[9px]">BOTTLENECK COMPRESSION</span>
              <span className="text-sm font-semibold">
                {focusedNode.layer === 'latent'
                  ? '100% Core'
                  : focusedNode.layer === 'input'
                    ? 'Encoder Input'
                    : 'Decoder Output'}
              </span>
            </GlowCard>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-silver-500 font-mono text-[9px]">ACTIVATION WAVEFORM</span>
            <div className="flex h-6 items-end gap-0.5 rounded bg-black/10 px-1.5 py-0.5">
              {focusedNode.simulatedHistory.map((val, idx) => (
                <div
                  key={idx}
                  className="bg-brass-500/80 flex-1 rounded-t"
                  style={{ height: `${Math.min(100, val * 100)}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : animationMode === 'train' ? (
        <div className="bg-carbon-950/70 border-carbon-800/80 flex items-center justify-between rounded-lg border p-2.5 font-mono text-[10px]">
          <div className="flex flex-col">
            <span className="text-silver-500 text-[9px]">CURRENT LOSS</span>
            <span className="text-sm font-semibold text-emerald-400 tabular-nums">
              {loss.toFixed(6)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-silver-500 text-[9px]">SIMULATED EPOCH</span>
            <span className="text-silver-200 text-sm font-semibold tabular-nums">{epoch}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetTrain}
            className="flex h-7 items-center gap-1 px-2.5 text-[10px] font-bold"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      ) : (
        <div className="text-silver-500 p-1.5 text-center font-mono text-[10px]">
          Select nodes in the visualizer above to inspect bottleneck layer activations.
        </div>
      )}
    </div>
  )
}
