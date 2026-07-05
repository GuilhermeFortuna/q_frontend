import { Sliders } from 'lucide-react'

import type { ChartSettings } from '@/components/charts/types/chart'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'

type ChartSettingsPopoverProps = {
  settings: ChartSettings
  onChange: (settings: ChartSettings) => void
}

const PRESET_BACKGROUNDS = [
  {
    name: 'Deep Space',
    type: 'gradient' as const,
    value: 'radial-gradient(circle at 50% 30%, #16273f 0%, #07101c 100%)',
  },
  { name: 'Obsidian Dark', type: 'solid' as const, value: '#050507' },
  { name: 'Midnight Blue', type: 'solid' as const, value: '#090e17' },
  { name: 'Carbon Gray', type: 'solid' as const, value: '#15161b' },
]

export function ChartSettingsPopover({ settings, onChange }: ChartSettingsPopoverProps) {
  const updateField = <K extends keyof ChartSettings>(field: K, value: ChartSettings[K]) => {
    onChange({ ...settings, [field]: value })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-brass-600/15 bg-carbon-900/50 hover:bg-carbon-800/85 text-silver-300 hover:text-brass-400 hover:border-brass-500/40 flex animate-none cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 active:scale-95"
          aria-label="Chart Settings"
        >
          <Sliders className="h-3 w-3" />
          Appearance
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 space-y-4 rounded-lg p-3">
        {/* Background selection */}
        <div className="space-y-1.5">
          <span className="text-silver-400 block font-mono text-[9px] font-bold tracking-wider uppercase">
            Background Theme
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_BACKGROUNDS.map((bg) => (
              <button
                key={bg.name}
                type="button"
                onClick={() => {
                  onChange({
                    ...settings,
                    backgroundType: bg.type,
                    backgroundColor: bg.value,
                  })
                }}
                className={`cursor-pointer rounded border p-1.5 text-center font-mono text-[9px] font-bold transition-all duration-150 active:scale-95 ${
                  settings.backgroundColor === bg.value
                    ? 'border-brass-500 bg-brass-500/10 text-brass-400'
                    : 'border-carbon-700 bg-carbon-950/40 text-silver-400 hover:text-silver-200'
                }`}
              >
                {bg.name}
              </button>
            ))}
          </div>
        </div>

        {/* Candle Opacity Slider */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[9px] font-bold tracking-wider uppercase">
            <span className="text-silver-400">Candle Opacity</span>
            <span className="text-brass-400">{Math.round(settings.candleOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={settings.candleOpacity}
            onChange={(e) => updateField('candleOpacity', Number(e.target.value))}
            className="accent-brass-500 bg-carbon-950 h-1 w-full cursor-pointer appearance-none rounded-lg"
          />
        </div>

        {/* Volume Opacity Slider */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[9px] font-bold tracking-wider uppercase">
            <span className="text-silver-400">Volume Opacity</span>
            <span className="text-brass-400">{Math.round(settings.volumeOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={settings.volumeOpacity}
            onChange={(e) => updateField('volumeOpacity', Number(e.target.value))}
            className="accent-brass-500 bg-carbon-950 h-1 w-full cursor-pointer appearance-none rounded-lg"
          />
        </div>

        {/* Watermark Toggle */}
        <div className="border-carbon-800/40 flex items-center justify-between border-t pt-2.5">
          <span className="text-silver-400 font-mono text-[9px] font-bold tracking-wider uppercase">
            Show Watermark
          </span>
          <label className="relative inline-flex cursor-pointer items-center select-none">
            <input
              type="checkbox"
              checked={settings.showWatermark}
              onChange={(e) => updateField('showWatermark', e.target.checked)}
              className="peer sr-only"
            />
            <div className="bg-carbon-850 peer after:bg-silver-400 after:border-carbon-600 peer-checked:bg-brass-500/30 peer-checked:after:bg-brass-400 peer-checked:after:border-brass-400 h-4 w-7 rounded-full peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:border after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}
