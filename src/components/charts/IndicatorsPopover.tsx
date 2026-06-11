import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

import type { IndicatorConfig } from '@/components/charts/types/chart'
import { DEFAULT_INDICATORS } from '@/components/charts/types/chart'

type IndicatorsPopoverProps = {
  indicators: IndicatorConfig[]
  onChange: (indicators: IndicatorConfig[]) => void
}

export function IndicatorsPopover({ indicators, onChange }: IndicatorsPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (type: IndicatorConfig['type']) => {
    onChange(indicators.map((ind) => (ind.type === type ? { ...ind, enabled: !ind.enabled } : ind)))
  }

  const updatePeriod = (type: IndicatorConfig['type'], field: string, value: number) => {
    onChange(
      indicators.map((ind) => {
        if (ind.type !== type) return ind
        return { ...ind, [field]: value } as IndicatorConfig
      }),
    )
  }

  const activeCount = indicators.filter((i) => i.enabled).length

  return (
    <div className="border-carbon-700 relative border-r pr-4" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border-brass-600/15 bg-carbon-900/50 hover:bg-carbon-800/85 text-silver-300 hover:text-brass-400 hover:border-brass-500/40 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 active:scale-95"
      >
        Indicators
        {activeCount > 0 && (
          <span className="bg-brass-500/20 text-brass-400 rounded px-1.5 py-0.5 text-[9px] leading-none font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="quant-panel absolute top-full right-0 z-20 mt-1.5 w-56 rounded-lg p-2.5 shadow-xl">
          {indicators.map((ind) => (
            <div
              key={ind.type}
              className="hover:bg-carbon-800/60 flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors duration-150"
            >
              <label className="text-silver-300 flex flex-1 cursor-pointer items-center gap-2 font-mono text-[10px] uppercase select-none">
                <input
                  type="checkbox"
                  checked={ind.enabled}
                  onChange={() => toggle(ind.type)}
                  className="accent-brass-500 border-carbon-700 rounded focus:ring-0"
                />
                {ind.type === 'sma' && `SMA (${ind.period})`}
                {ind.type === 'ema' && `EMA (${ind.period})`}
                {ind.type === 'bollinger' && `Bollinger (${ind.period})`}
                {ind.type === 'rsi' && `RSI (${ind.period})`}
                {ind.type === 'macd' && 'MACD'}
              </label>
              {(ind.type === 'sma' ||
                ind.type === 'ema' ||
                ind.type === 'bollinger' ||
                ind.type === 'rsi') && (
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={ind.period}
                  onChange={(e) => updatePeriod(ind.type, 'period', Number(e.target.value))}
                  className="border-brass-600/15 bg-carbon-950/80 text-silver-200 focus:border-brass-500/50 w-12 rounded px-1.5 py-0.5 font-mono text-[10px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_INDICATORS }
