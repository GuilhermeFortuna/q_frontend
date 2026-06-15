import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import type { IndicatorConfig } from '@/components/charts/types/chart'
import type { OhlcvBar } from '@/types/api'
import { IndicatorsModal } from './IndicatorsModal'

type IndicatorsPopoverProps = {
  indicators: IndicatorConfig[]
  onChange: (indicators: IndicatorConfig[]) => void
  bars: OhlcvBar[]
}

export function IndicatorsPopover({ indicators, onChange, bars }: IndicatorsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const activeCount = indicators.filter((i) => i.enabled).length

  return (
    <div className="border-carbon-700 relative border-r pr-4">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="border-brass-600/15 bg-carbon-900/50 hover:bg-carbon-800/85 text-silver-300 hover:text-brass-400 hover:border-brass-500/40 flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 active:scale-95"
      >
        Indicators
        {activeCount > 0 && (
          <span className="bg-brass-500/20 text-brass-400 rounded px-1.5 py-0.5 text-[9px] leading-none font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      <IndicatorsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        indicators={indicators}
        bars={bars}
        onChange={onChange}
      />
    </div>
  )
}
