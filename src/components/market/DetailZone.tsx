import { useState } from 'react'

const DETAIL_TABS = ['QUOTE', 'TAPE', 'INFO'] as const

type DetailTab = (typeof DETAIL_TABS)[number]

export function DetailZone() {
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

      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-silver-500 font-mono text-xs">Coming soon</p>
      </div>
    </div>
  )
}
