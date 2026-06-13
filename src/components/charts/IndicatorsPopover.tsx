import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Settings } from 'lucide-react'

import type { IndicatorConfig } from '@/components/charts/types/chart'

export { DEFAULT_INDICATORS } from '@/components/charts/types/chart'

type IndicatorsPopoverProps = {
  indicators: IndicatorConfig[]
  onChange: (indicators: IndicatorConfig[]) => void
}

const PRESET_COLORS = [
  { name: 'Brass', value: '#c9a227' },
  { name: 'Emerald', value: '#26a69a' },
  { name: 'Rose', value: '#ef5350' },
  { name: 'Blue', value: '#6eb5ff' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Orange', value: '#f97316' },
  { name: 'White', value: '#ffffff' },
]

const STYLES = [
  { name: 'Solid', value: 'solid' as const },
  { name: 'Dashed', value: 'dashed' as const },
  { name: 'Dotted', value: 'dotted' as const },
]

const WIDTHS = [1.0, 2.0, 3.0]

export function IndicatorsPopover({ indicators, onChange }: IndicatorsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [expandedType, setExpandedType] = useState<IndicatorConfig['type'] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setExpandedType(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (type: IndicatorConfig['type']) => {
    onChange(indicators.map((ind) => (ind.type === type ? { ...ind, enabled: !ind.enabled } : ind)))
  }

  const updateField = (type: IndicatorConfig['type'], field: string, value: unknown) => {
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

      {open && (
        <div className="quant-panel absolute top-full right-0 z-20 mt-1.5 max-h-[380px] w-64 space-y-0.5 overflow-y-auto rounded-lg p-2 shadow-xl">
          {indicators.map((ind) => {
            const isExpanded = expandedType === ind.type
            return (
              <div
                key={ind.type}
                className="hover:bg-carbon-850/35 flex flex-col rounded p-1 transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <label className="text-silver-300 flex flex-1 cursor-pointer items-center gap-2 p-1 font-mono text-[10px] uppercase select-none">
                    <input
                      type="checkbox"
                      checked={ind.enabled}
                      onChange={() => toggle(ind.type)}
                      className="accent-brass-500 border-carbon-700 cursor-pointer rounded focus:ring-0"
                    />
                    {ind.type === 'sma' && `SMA`}
                    {ind.type === 'ema' && `EMA`}
                    {ind.type === 'bollinger' && `Bollinger`}
                    {ind.type === 'rsi' && `RSI`}
                    {ind.type === 'macd' && 'MACD'}
                    {ind.type === 'volumeMa' && 'Volume MA'}
                  </label>

                  <div className="flex items-center gap-1.5">
                    {/* Period Input */}
                    {ind.type !== 'macd' && 'period' in ind && (
                      <input
                        type="number"
                        min={2}
                        max={200}
                        value={ind.period}
                        onChange={(e) => updateField(ind.type, 'period', Number(e.target.value))}
                        className="border-brass-600/15 bg-carbon-950/80 text-silver-200 focus:border-brass-500/50 w-11 rounded px-1 py-0.5 text-center font-mono text-[9px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none"
                      />
                    )}

                    {/* Settings Gear */}
                    <button
                      type="button"
                      onClick={() => setExpandedType(isExpanded ? null : ind.type)}
                      className={`hover:bg-carbon-800/80 cursor-pointer rounded p-1 transition-colors duration-150 ${
                        isExpanded ? 'text-brass-400' : 'text-silver-500 hover:text-silver-200'
                      }`}
                      aria-label={`Configure ${ind.type}`}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Customization Tray */}
                {isExpanded && (
                  <div className="bg-carbon-950/50 border-carbon-800/40 text-silver-400 mx-1 mt-1 mb-1 space-y-2.5 rounded border p-2 font-mono text-[9px]">
                    {/* Color Swatches */}
                    {ind.type !== 'macd' && (
                      <div className="space-y-1">
                        <span className="text-silver-500 block font-bold tracking-wider uppercase">
                          Color
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => updateField(ind.type, 'color', c.value)}
                              style={{ backgroundColor: c.value }}
                              className={`h-4 w-4 cursor-pointer rounded-full border transition-all duration-150 active:scale-90 ${
                                'color' in ind && ind.color === c.value
                                  ? 'scale-110 border-white shadow-md shadow-black/50'
                                  : 'border-carbon-800 hover:border-silver-400'
                              }`}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Line Style Selection */}
                    {'lineStyle' in ind && (
                      <div className="space-y-1">
                        <span className="text-silver-500 block font-bold tracking-wider uppercase">
                          Style
                        </span>
                        <div className="bg-carbon-950 border-carbon-800/50 grid grid-cols-3 gap-1 rounded border p-0.5">
                          {STYLES.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => updateField(ind.type, 'lineStyle', s.value)}
                              className={`cursor-pointer rounded py-0.5 text-center text-[8px] font-bold transition-all duration-150 ${
                                ind.lineStyle === s.value
                                  ? 'bg-brass-500/15 text-brass-400'
                                  : 'text-silver-500 hover:text-silver-300'
                              }`}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Line Stroke Width */}
                    {'strokeWidth' in ind && (
                      <div className="space-y-1">
                        <span className="text-silver-500 block font-bold tracking-wider uppercase">
                          Width
                        </span>
                        <div className="bg-carbon-950 border-carbon-800/50 grid grid-cols-3 gap-1 rounded border p-0.5">
                          {WIDTHS.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => updateField(ind.type, 'strokeWidth', w)}
                              className={`cursor-pointer rounded py-0.5 text-center text-[8px] font-bold transition-all duration-150 ${
                                ind.strokeWidth === w
                                  ? 'bg-brass-500/15 text-brass-400'
                                  : 'text-silver-500 hover:text-silver-300'
                              }`}
                            >
                              {w}px
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bollinger / RSI Cloud Toggle */}
                    {'showCloud' in ind && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-silver-500 font-bold tracking-wider uppercase">
                          Show Cloud Fill
                        </span>
                        <input
                          type="checkbox"
                          checked={ind.showCloud}
                          onChange={(e) => updateField(ind.type, 'showCloud', e.target.checked)}
                          className="accent-brass-500 border-carbon-700 cursor-pointer rounded focus:ring-0"
                        />
                      </div>
                    )}

                    {/* MACD Custom Color Settings Info */}
                    {ind.type === 'macd' && (
                      <div className="text-silver-500 text-[8px] leading-normal italic">
                        MACD uses standard signal line overlay styling with automated
                        positive/negative histogram colors.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
