import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { neuralKeys } from '@/api/queries/neural'
import { NeuralModelDetail } from '@/components/research/neural/NeuralModelDetail'
import { NeuralModelList } from '@/components/research/neural/NeuralModelList'
import { NeuralTrainForm } from '@/components/research/neural/NeuralTrainForm'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'

export type NeuralFeaturesTabProps = {
  activeTrainingJobId: string | null
  onTrainingStarted: (jobId: string, label: string) => void
  onClearTrainingJob: () => void
}

export function NeuralFeaturesTab({
  activeTrainingJobId,
  onTrainingStarted,
  onClearTrainingJob,
}: NeuralFeaturesTabProps) {
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const handleTrainingCompleted = (modelHash: string) => {
    void queryClient.invalidateQueries({ queryKey: [...neuralKeys.all, 'list'] })
    void queryClient.invalidateQueries({ queryKey: neuralKeys.version(modelHash) })
    setSelectedHash(modelHash)
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden" data-testid="research-tab-neural">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
        <NeuralTrainForm
          activeJobId={activeTrainingJobId}
          onTrainingStarted={onTrainingStarted}
          onTrainingCompleted={handleTrainingCompleted}
          onClearJob={onClearTrainingJob}
        />
        <Panel className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <SectionHeader title="Neural Features" />
          <p className="text-silver-500 text-xs">
            Registered encoder versions — inspect validation metrics, gate verdicts, and promote
            lifecycle status.
          </p>
          <NeuralModelList selectedHash={selectedHash} onSelectModel={setSelectedHash} />
        </Panel>
      </div>
      {selectedHash ? (
        <NeuralModelDetail modelHash={selectedHash} onClose={() => setSelectedHash(null)} />
      ) : null}
    </div>
  )
}
