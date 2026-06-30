import { useState } from 'react'

import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { AlphaResearchPanel } from '@/components/research/experiments/AlphaResearchPanel'
import { DiscoveryAbPanel } from '@/components/research/experiments/DiscoveryAbPanel'
import { EncoderAblationPanel } from '@/components/research/experiments/EncoderAblationPanel'

type ExperimentsTab = 'ab' | 'ablation' | 'alpha_research'

export function ExperimentsWorkspace() {
  const [activeTab, setActiveTab] = useState<ExperimentsTab>('ab')

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden"
      data-testid="research-tab-experiments"
    >
      <div className="flex shrink-0 items-center justify-start">
        <SegmentedToggle
          aria-label="Experiments sub-tabs"
          options={[
            { value: 'ab', label: 'Discovery A/B' },
            { value: 'ablation', label: 'Encoder Ablation' },
            { value: 'alpha_research', label: 'Alpha Research' },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as ExperimentsTab)}
        />
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'ab' ? <DiscoveryAbPanel /> : null}
        {activeTab === 'ablation' ? <EncoderAblationPanel /> : null}
        {activeTab === 'alpha_research' ? (
          <AlphaResearchPanel isActive={activeTab === 'alpha_research'} />
        ) : null}
      </div>
    </div>
  )
}
