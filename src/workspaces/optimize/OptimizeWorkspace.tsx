import axios from 'axios'
import { useEffect, useState } from 'react'

import {
  useCancelOptimization,
  useOptimizationResults,
  useOptimizationStatus,
  useStartOptimization,
} from '@/api/queries/optimize'
import { OptimizationResultsPanel } from '@/components/optimize/OptimizationResultsPanel'
import { OptimizationWorkbench } from '@/components/optimize/OptimizationWorkbench'
import { OptimizeConfigForm } from '@/components/optimize/OptimizeConfigForm'
import type { OptimizationConfig } from '@/types/optimization'

export function OptimizeWorkspace() {
  const [studyId, setStudyId] = useState<string | null>(null)
  const [submittedConfig, setSubmittedConfig] = useState<OptimizationConfig | null>(null)
  const [workbenchOpen, setWorkbenchOpen] = useState(true)

  const startOptimization = useStartOptimization()
  const cancelOptimization = useCancelOptimization()
  const statusQuery = useOptimizationStatus(studyId)
  const status = statusQuery.data

  const hasTerminalResults = status?.status === 'done' || status?.status === 'cancelled'
  const resultsQuery = useOptimizationResults(studyId, hasTerminalResults)

  const isRunning =
    startOptimization.isPending || status?.status === 'pending' || status?.status === 'running'

  useEffect(() => {
    if (isRunning || hasTerminalResults) {
      setWorkbenchOpen(false)
    }
  }, [isRunning, hasTerminalResults])

  const handleSubmit = (config: OptimizationConfig) => {
    setSubmittedConfig(config)
    startOptimization.mutate(config, {
      onSuccess: (res) => {
        setStudyId(res.study_id)
        setWorkbenchOpen(false)
      },
    })
  }

  const handleCancel = () => {
    if (studyId) cancelOptimization.mutate(studyId)
  }

  const startError = startOptimization.error
    ? axios.isAxiosError(startOptimization.error)
      ? ((startOptimization.error.response?.data as { detail?: string })?.detail ??
        startOptimization.error.message)
      : 'Failed to start optimization'
    : null

  return (
    <div className="text-silver-100 flex h-[calc(100dvh-4.5rem-7rem)] w-full overflow-hidden">
      <OptimizationWorkbench open={workbenchOpen} onOpenChange={setWorkbenchOpen}>
        <OptimizeConfigForm
          loading={startOptimization.isPending}
          error={startError}
          disabled={isRunning}
          onSubmit={handleSubmit}
        />
      </OptimizationWorkbench>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <OptimizationResultsPanel
          isRunning={isRunning}
          status={status}
          results={resultsQuery.data}
          backtest={submittedConfig?.backtest ?? null}
          onCancel={handleCancel}
          cancelling={cancelOptimization.isPending}
          onOpenWorkbench={() => setWorkbenchOpen(true)}
        />
      </div>
    </div>
  )
}
