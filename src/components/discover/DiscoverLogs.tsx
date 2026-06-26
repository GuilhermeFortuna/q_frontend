import { useState, useEffect, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/Panel'
import { PanelHeader } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

export interface ParsedTrial {
  timestamp: string
  candidateId?: string
  windowIndex?: string
  trialNumber: string
  status: 'completed' | 'pruned' | 'error'
  value?: number
  parameters: Record<string, string>
  bestTrialNumber?: string
  bestValue?: string
  raw: string
}

type DiscoverLogsProps = {
  logs: string[] | undefined
}

export function parseTrialLog(logLine: string): ParsedTrial | null {
  // Capture Optuna log format:
  // [I 2026-06-15 07:37:19,667] Candidate Candidate_1 - Window 0 - Trial 16 finished with value: -0.6453689320511332 and parameters: {'strategy__period': 27, 'strategy__threshold': 94.89}. Best is trial 0 with value: -0.6453689320511332.
  const match = logLine.match(
    /\[I (.*?)\] (?:Candidate (.*?) - )?(?:Window (\d+) - )?Trial (\d+) finished with (value: [-\d.]+|state: \w+)(?: and parameters: (.*?))?\.(?:\s*Best is trial (\d+) with value: (.*?))?/,
  )
  if (!match) return null

  const timestamp = match[1]
  const candidateId = match[2]
  const windowIndex = match[3]
  const trialNumber = match[4]
  const valOrState = match[5]
  const rawParams = match[6]
  const bestTrialNumber = match[7]
  const bestValue = match[8]

  let status: 'completed' | 'pruned' | 'error' = 'completed'
  let value: number | undefined

  if (valOrState.startsWith('value:')) {
    status = 'completed'
    value = parseFloat(valOrState.replace('value:', '').trim())
  } else if (valOrState.includes('PRUNED')) {
    status = 'pruned'
  } else {
    status = 'error'
  }

  const parameters: Record<string, string> = {}
  if (rawParams) {
    try {
      const jsonParams = rawParams
        .replace(/'/g, '"')
        .replace(/None/g, 'null')
        .replace(/True/g, 'true')
        .replace(/False/g, 'false')
      const parsed = JSON.parse(jsonParams)
      Object.entries(parsed).forEach(([k, v]) => {
        const key = k.replace(/^strategy__/, '')
        parameters[key] = String(v)
      })
    } catch {
      rawParams.split(',').forEach((p) => {
        const parts = p.split(':')
        if (parts.length === 2) {
          const key = parts[0].replace(/['"\s]/g, '').replace(/^strategy__/, '')
          const val = parts[1].replace(/['"\s]/g, '')
          parameters[key] = val
        }
      })
    }
  }

  return {
    timestamp,
    candidateId,
    windowIndex,
    trialNumber,
    status,
    value,
    parameters,
    bestTrialNumber,
    bestValue,
    raw: logLine,
  }
}

export function DiscoverLogs({ logs = [] }: DiscoverLogsProps) {
  const [activeTab, setActiveTab] = useState<'parsed' | 'console'>('parsed')
  const [hidePruned, setHidePruned] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const consoleBottomRef = useRef<HTMLDivElement>(null)
  const tableBottomRef = useRef<HTMLDivElement>(null)

  const parsedTrials = useMemo(() => {
    return logs.map(parseTrialLog).filter((t): t is ParsedTrial => t !== null)
  }, [logs])

  const filteredTrials = useMemo(() => {
    if (hidePruned) {
      return parsedTrials.filter((t) => t.status !== 'pruned')
    }
    return parsedTrials
  }, [parsedTrials, hidePruned])

  // Scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll) {
      if (activeTab === 'console') {
        consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      } else {
        tableBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [logs, activeTab, autoScroll])

  return (
    <Panel className="flex min-h-0 w-full flex-1 flex-col overflow-hidden p-0">
      <PanelHeader
        title="Trial logs"
        right={
          <div className="flex items-center gap-4">
            <SegmentedToggle
              aria-label="Log view"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: 'parsed', label: 'Parsed Trials' },
                { value: 'console', label: 'Raw Stream' },
              ]}
            />
            {activeTab === 'parsed' ? (
              <label className="text-silver-400 flex cursor-pointer items-center gap-1.5 text-xs select-none">
                <input
                  type="checkbox"
                  checked={hidePruned}
                  onChange={(e) => setHidePruned(e.target.checked)}
                  className="accent-brass-500 border-carbon-600 bg-carbon-900 h-3.5 w-3.5 rounded"
                />
                Hide Pruned
              </label>
            ) : null}
            <label className="text-silver-400 flex cursor-pointer items-center gap-1.5 text-xs select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-brass-500 border-carbon-600 bg-carbon-900 h-3.5 w-3.5 rounded"
              />
              Auto Scroll
            </label>
          </div>
        }
      />

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <p className="text-silver-500 text-sm italic">Waiting for trials to start...</p>
          </div>
        ) : activeTab === 'console' ? (
          <Panel className="text-silver-300 h-full space-y-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
            {logs.map((log, index) => (
              <div
                key={index}
                className="border-carbon-700 hover:bg-carbon-900/45 border-l-2 py-0.5 pl-2 whitespace-pre-wrap"
              >
                {log}
              </div>
            ))}
            <div ref={consoleBottomRef} />
          </Panel>
        ) : (
          <div className="h-full min-h-0 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="text-silver-400 bg-carbon-900/80 sticky top-0 z-10">
                <tr className="border-carbon-800 border-b">
                  <th className="bg-carbon-900 px-3 py-2 font-medium">Trial</th>
                  <th className="bg-carbon-900 px-3 py-2 font-medium">Candidate</th>
                  <th className="bg-carbon-900 px-3 py-2 font-medium">Window</th>
                  <th className="bg-carbon-900 px-3 py-2 font-medium">Status / Value</th>
                  <th className="bg-carbon-900 px-3 py-2 font-medium">Parameters</th>
                  <th className="bg-carbon-900 px-3 py-2 font-medium">Best Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrials.map((trial, idx) => {
                  const isComplete = trial.status === 'completed'
                  const isPruned = trial.status === 'pruned'

                  return (
                    <tr
                      key={`${trial.candidateId}-${trial.windowIndex}-${trial.trialNumber}-${idx}`}
                      className="text-silver-200 border-carbon-900/60 hover:bg-carbon-900/20 border-b"
                    >
                      <td className="px-3 py-2.5 font-mono">#{trial.trialNumber}</td>
                      <td className="max-w-[120px] truncate px-3 py-2.5" title={trial.candidateId}>
                        {trial.candidateId ? trial.candidateId.split('_').slice(-2).join('_') : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {trial.windowIndex !== undefined ? `w${trial.windowIndex}` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
                            isComplete
                              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              : isPruned
                                ? 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                                : 'border border-rose-500/20 bg-rose-500/10 text-rose-400',
                          )}
                        >
                          {isComplete
                            ? trial.value !== undefined
                              ? trial.value.toFixed(6)
                              : 'success'
                            : trial.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(trial.parameters).map(([k, v]) => (
                            <span
                              key={k}
                              className="bg-carbon-800 text-silver-300 border-carbon-700/50 rounded border px-1 py-0.5 font-mono text-[10px]"
                            >
                              {k}:{v}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-silver-400 px-3 py-2.5 font-mono">
                        {trial.bestValue ? parseFloat(trial.bestValue).toFixed(6) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div ref={tableBottomRef} />
          </div>
        )}
      </div>
    </Panel>
  )
}
