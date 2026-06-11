import { useState } from 'react'

import type { MarketSnapshot } from '@/types/api'

import { InstrumentInfoPanel } from './InstrumentInfoPanel'
import { QuotePanel } from './QuotePanel'
import { TimeAndSalesPanel } from './TimeAndSalesPanel'

const DETAIL_TABS = ['QUOTE', 'TAPE', 'INFO'] as const

type DetailTab = (typeof DETAIL_TABS)[number]

export type DetailZoneProps = {
  symbol: string
  snapshot: MarketSnapshot | undefined
}

export function DetailZone({ symbol, snapshot }: DetailZoneProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('QUOTE')

  return (
    <div className="quant-panel flex h-full flex-col overflow-hidden rounded-lg">
      <div className="border-carbon-700 flex items-center gap-1 border-b px-3 py-2">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded px-2 py-1 font-mono text-[10px] font-bold tracking-wider uppercase transition-all ${
              activeTab === tab
                ? 'bg-brass-500/20 text-brass-400'
                : 'text-silver-400 hover:text-silver-200 hover:bg-carbon-800/60'
            }`}
          >
            {tab}
          </button>
        ))}
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
    </div>
  )
}
