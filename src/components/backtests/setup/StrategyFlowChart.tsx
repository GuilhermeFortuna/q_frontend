import { useEffect, useRef, useState, useMemo } from 'react'
import { Activity, ShieldAlert, Zap } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { GlowCard } from '@/components/ui/spotlight-card'
import { cn } from '@/lib/utils'
import type { ExitRuleInfo, StrategyInfo } from '@/types/strategies'

type ConnectionPath = {
  fromId: string
  toId: string
  d: string
}

type StrategyFlowChartProps = {
  entries: Array<{ strategy: string; slotId: string }>
  entryManager: string
  enabledExitRules: ExitRuleInfo[]
  isComposite: boolean
  strategies: StrategyInfo[]
  hasActiveJobs?: boolean
}

export function StrategyFlowChart({
  entries,
  entryManager,
  enabledExitRules,
  isComposite,
  strategies,
  hasActiveJobs = false,
}: StrategyFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [connections, setConnections] = useState<ConnectionPath[]>([])
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Resolve labels for entries
  const entryNodes = useMemo(() => {
    return entries.map((entry, index) => {
      const match = strategies.find((s) => s.name === entry.strategy)
      return {
        id: `entry-${entry.slotId}`,
        label: match?.label || entry.strategy,
        index,
      }
    })
  }, [entries, strategies])

  // Recalculate coordinates for SVG paths
  const updatePaths = () => {
    if (!containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    setDimensions({ width: rect.width, height: rect.height })

    const nodes: Record<string, { x: number; y: number }> = {}

    // Find all node elements and calculate center relative to container
    const nodeElements = container.querySelectorAll('[data-node-id]')
    nodeElements.forEach((el) => {
      const nodeId = el.getAttribute('data-node-id')
      if (!nodeId) return
      const elRect = el.getBoundingClientRect()

      // Center coordinates relative to container top-left
      nodes[nodeId] = {
        x: elRect.left - rect.left + elRect.width / 2,
        y: elRect.top - rect.top + elRect.height / 2,
      }
    })

    const newConnections: ConnectionPath[] = []
    const managerId = 'manager-node'
    const executionId = 'execution-node'

    const hasManager = entries.length > 1 && !isComposite

    // Connections from Entries to either Manager or Execution Node
    entryNodes.forEach((entry) => {
      const entryId = entry.id
      const targetId = hasManager ? managerId : executionId

      if (nodes[entryId] && nodes[targetId]) {
        const from = nodes[entryId]
        const to = nodes[targetId]
        // Bezier curve
        const dx = Math.abs(to.x - from.x) * 0.5
        const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
        newConnections.push({ fromId: entryId, toId: targetId, d })
      }
    })

    // Connection from Manager to Execution Node
    if (hasManager && nodes[managerId] && nodes[executionId]) {
      const from = nodes[managerId]
      const to = nodes[executionId]
      const dx = Math.abs(to.x - from.x) * 0.5
      const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
      newConnections.push({ fromId: managerId, toId: executionId, d })
    }

    // Connections from Execution Node to Exits
    enabledExitRules.forEach((rule) => {
      const exitId = `exit-${rule.id}`
      if (nodes[executionId] && nodes[exitId]) {
        const from = nodes[executionId]
        const to = nodes[exitId]
        const dx = Math.abs(to.x - from.x) * 0.5
        const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
        newConnections.push({ fromId: executionId, toId: exitId, d })
      }
    })

    setConnections(newConnections)
  }

  useEffect(() => {
    // Run after dom has painted/settled
    const timer = setTimeout(() => {
      updatePaths()
    }, 100)

    window.addEventListener('resize', updatePaths)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePaths)
    }
  }, [entryNodes, enabledExitRules, isComposite, entryManager])

  return (
    <Panel
      className="relative flex min-h-[16rem] w-full flex-col justify-between overflow-hidden rounded-lg p-4"
      data-testid="strategy-flow-chart"
    >
      <div
        ref={containerRef}
        className="relative flex min-h-[16rem] w-full flex-1 flex-col justify-between"
      >
        {/* Background Grid Accent */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(var(--color-carbon-700) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* SVG Canvas for Drawing Connections */}
        <svg
          className="pointer-events-none absolute inset-0 z-0"
          width={dimensions.width}
          height={dimensions.height}
        >
          <defs>
            <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-silver-400)" stopOpacity="0.15" />
              <stop offset="50%" stopColor="var(--color-brass-500)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-brass-400)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {connections.map((conn, idx) => (
            <g key={idx}>
              {/* Background glowing line */}
              <path
                d={conn.d}
                fill="none"
                stroke="var(--color-brass-500)"
                strokeWidth={3}
                className="opacity-10 blur-[1px]"
              />
              {/* Animated flow line */}
              <path
                d={conn.d}
                fill="none"
                stroke="url(#flow-gradient)"
                strokeWidth={1.5}
                strokeDasharray="6, 6"
                className={cn(
                  'transition-all duration-300',
                  hasActiveJobs
                    ? 'animate-[dash_1s_linear_infinite]'
                    : 'animate-[dash_6s_linear_infinite]',
                )}
              />
            </g>
          ))}
        </svg>

        <div className="border-carbon-850/50 relative z-10 flex items-center justify-between border-b pb-2">
          <h4 className="accent-wayfinding flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
            <Activity className="text-brass-400 h-3.5 w-3.5" />
            Strategy Execution Flow
          </h4>
          <div className="flex items-center gap-2">
            {hasActiveJobs && (
              <span className="bg-brass-400 flex h-1.5 w-1.5 animate-pulse rounded-full" />
            )}
            <span className="text-silver-400 text-[10px] font-medium">
              {isComposite
                ? 'COMPOSITE GENOME'
                : `${entries.length} ENTR${entries.length === 1 ? 'Y' : 'IES'} · ${enabledExitRules.length} EXIT${enabledExitRules.length === 1 ? '' : 'S'}`}
            </span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-[1.2fr_0.8fr_1fr_1fr] items-center gap-2 py-4">
          {/* Column 1: Entry Instances */}
          <div className="flex flex-col gap-2.5">
            {entryNodes.map((entry) => (
              <GlowCard
                key={entry.id}
                intensity="tile"
                data-node-id={entry.id}
                className="rounded px-2 py-1.5 text-center transition-all"
              >
                <div className="text-silver-400 font-mono text-[8px]">e{entry.index}</div>
                <div className="text-silver-200 truncate text-[10px] leading-tight font-medium">
                  {entry.label}
                </div>
              </GlowCard>
            ))}
            {entryNodes.length === 0 && (
              <div className="text-silver-500 py-2 text-center text-[10px] italic">
                No entries selected
              </div>
            )}
          </div>

          {/* Column 2: Signal Manager */}
          <div className="flex justify-center">
            {entries.length > 1 && !isComposite ? (
              <div
                data-node-id="manager-node"
                className="surface-well border-brass-600/30 flex h-11 w-16 flex-col items-center justify-center rounded-lg border text-center shadow-inner"
                title={`Signal Manager: ${entryManager}`}
              >
                <span className="text-silver-400 font-mono text-[7px] tracking-wider uppercase">
                  Manager
                </span>
                <span className="text-brass-400 text-[10px] font-bold uppercase">
                  {entryManager}
                </span>
              </div>
            ) : (
              <div className="h-1" />
            )}
          </div>

          {/* Column 3: Strategy Execution Node */}
          <div className="flex justify-center">
            <div
              data-node-id="execution-node"
              className={cn(
                'border-brass-500/40 relative flex h-16 w-16 flex-col items-center justify-center rounded-full border text-center shadow-lg',
                hasActiveJobs
                  ? 'bg-brass-600/10 shadow-[0_0_15px_-3px_rgba(217,158,34,0.25)]'
                  : 'bg-carbon-900/40',
              )}
            >
              <div className="border-silver-400/10 absolute inset-0.5 animate-[spin_40s_linear_infinite] rounded-full border border-dashed" />
              <Zap
                className={cn(
                  'h-4 w-4 transition-colors',
                  hasActiveJobs ? 'text-brass-400 animate-pulse' : 'text-silver-300',
                )}
              />
              <span className="text-silver-300 mt-1 text-[7px] font-semibold tracking-wider uppercase">
                POSITION
              </span>
            </div>
          </div>

          {/* Column 4: Exit Strategy Cards */}
          <div className="flex flex-col gap-2.5">
            {enabledExitRules.map((rule) => (
              <GlowCard
                key={rule.id}
                intensity="tile"
                data-node-id={`exit-${rule.id}`}
                className="rounded px-2.5 py-1.5 text-center transition-all"
              >
                <div className="text-brass-500/70 text-[7px] font-bold tracking-wider uppercase">
                  {rule.exit_group.replace('_', ' ')}
                </div>
                <div className="text-silver-200 truncate text-[10px] leading-tight font-medium">
                  {rule.label}
                </div>
              </GlowCard>
            ))}
            {enabledExitRules.length === 0 && (
              <div className="text-silver-500 flex items-center justify-center gap-1 py-2 text-center text-[10px] italic">
                <ShieldAlert className="text-silver-500 h-3 w-3" />
                Unprotected Exits
              </div>
            )}
          </div>
        </div>

        {/* Inline styles to handle animation for stroke-dashoffset */}
        <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -120;
          }
        }
      `}</style>
      </div>
    </Panel>
  )
}
