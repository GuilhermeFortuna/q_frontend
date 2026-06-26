import { useState } from 'react'

import type { MarketSnapshot } from '@/types/api'
import { Panel } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

import { InstrumentInfoPanel } from './InstrumentInfoPanel'
import { QuotePanel } from './QuotePanel'
import { TimeAndSalesPanel } from './TimeAndSalesPanel'

const DETAIL_TABS = [
  { value: 'QUOTE' as const, label: 'Quote' },
  { value: 'TAPE' as const, label: 'Tape' },
  { value: 'INFO' as const, label: 'Info' },
]

type DetailTab = (typeof DETAIL_TABS)[number]['value']

export type DetailZoneProps = {
  symbol: string
  snapshot: MarketSnapshot | undefined
}

export function DetailZone({ symbol, snapshot }: DetailZoneProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('QUOTE')

  return (
    <Panel className="flex h-full flex-col overflow-hidden p-0">
      <div className="surface-well border-brass-600/15 flex items-center gap-1 border-b px-3 py-2">
        <SegmentedToggle
          aria-label="Detail panel"
          value={activeTab}
          onChange={setActiveTab}
          options={DETAIL_TABS}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'QUOTE' && <QuotePanel snapshot={snapshot} />}
        {activeTab === 'TAPE' && (
          <TimeAndSalesPanel
            symbol={symbol}
            enabled={activeTab === 'TAPE'}
            priceDigits={snapshot?.digits ?? 2}
          />
        )}
        {activeTab === 'INFO' && (
          <InstrumentInfoPanel symbol={symbol} enabled={activeTab === 'INFO'} />
        )}
      </div>
    </Panel>
  )
}
