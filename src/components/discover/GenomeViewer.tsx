import { useMemo, useState } from 'react'

import type { Genome, GenomeNode } from '@/types/strategySearch'
import { countGenomeParams } from '@/types/strategySearch'

type GenomeViewerProps = {
  genome: Genome
}

function formatParam(
  value: GenomeNode['params'] extends infer P
    ? P extends Record<string, infer V>
      ? V
      : never
    : never,
): string {
  if (typeof value === 'object' && value !== null && 'param' in value) {
    return `{param: ${value.param}}`
  }
  return String(value)
}

function NodeCard({ node }: { node: GenomeNode }) {
  return (
    <div className="border-carbon-600/40 bg-carbon-950/40 rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-brass-400 font-mono text-xs">{node.id}</span>
        <span className="text-silver-200 text-sm font-medium">{node.kind}</span>
      </div>
      {node.inputs && node.inputs.length > 0 ? (
        <p className="text-silver-500 mt-1 text-xs">inputs: {node.inputs.join(', ')}</p>
      ) : null}
      {node.params && Object.keys(node.params).length > 0 ? (
        <ul className="text-silver-400 mt-2 space-y-0.5 font-mono text-[11px]">
          {Object.entries(node.params).map(([key, value]) => (
            <li key={key}>
              {key}: {formatParam(value as never)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function GenomeViewer({ genome }: GenomeViewerProps) {
  const [showJson, setShowJson] = useState(false)
  const paramCount = useMemo(() => countGenomeParams(genome), [genome])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-silver-400 text-xs">
          <span className="text-silver-200 font-mono">{genome.genome_id}</span> ·{' '}
          {genome.nodes.length} nodes · {paramCount} optimizable params
          {genome.metadata?.generation != null ? ` · gen ${genome.metadata.generation}` : ''}
        </p>
        <button
          type="button"
          className="text-brass-400 text-xs font-semibold hover:underline"
          onClick={() => setShowJson((value) => !value)}
        >
          {showJson ? 'Tree view' : 'JSON view'}
        </button>
      </div>

      {showJson ? (
        <pre className="border-carbon-600/40 bg-carbon-950/60 text-silver-200 max-h-80 overflow-auto rounded-lg border p-3 font-mono text-[11px]">
          {JSON.stringify(genome, null, 2)}
        </pre>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {genome.nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      )}

      <div className="text-silver-500 grid gap-1 font-mono text-[11px] sm:grid-cols-2">
        <span>entry_long → {genome.entry_long.ref}</span>
        {genome.entry_short ? <span>entry_short → {genome.entry_short.ref}</span> : null}
        <span>exit_long → {genome.exit_long.ref}</span>
        {genome.exit_short ? <span>exit_short → {genome.exit_short.ref}</span> : null}
      </div>
    </div>
  )
}

export function ComplexityLine({
  genomeNodeCount,
  genome,
}: {
  genomeNodeCount: number | null | undefined
  genome: Genome | null | undefined
}) {
  if (genomeNodeCount == null && !genome) return null
  const nodes = genomeNodeCount ?? genome?.nodes.length ?? 0
  const params = genome ? countGenomeParams(genome) : null
  return (
    <p className="text-silver-500 text-xs">
      Complexity: {nodes} node{nodes === 1 ? '' : 's'}
      {params != null ? ` · ${params} optimizable param${params === 1 ? '' : 's'}` : ''}
    </p>
  )
}
