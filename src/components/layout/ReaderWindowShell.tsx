import type { ReactNode } from 'react'

import { QuantEmblem } from '@/components/brand/QuantEmblem'
import { PointerSpotlight } from '@/components/effects/PointerSpotlight'
import { WindowControls } from '@/components/layout/WindowControls'
import { BrightnessToggle } from '@/components/layout/BrightnessToggle'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'

type ReaderWindowShellProps = {
  children: ReactNode
  title?: string
  tag?: string
  mainClassName?: string
}

const BLACK_BG_MAP = {
  high: '/high_brightness/Quant_Background_Black_High_Brightness.jpeg',
  mid: '/mid_brightness/Quant_Background_Black_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Black_Mid_Brightness.jpeg', // Fallback to Mid for now
}

export function ReaderWindowShell({
  children,
  title = 'News Reader',
  tag = 'Market News',
  mainClassName,
}: ReaderWindowShellProps) {
  const resolvedBrightness = useResolvedBrightness()
  const bgImage = BLACK_BG_MAP[resolvedBrightness]

  return (
    <div className="bg-carbon-950 relative flex h-screen flex-col overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-90 transition-all duration-700"
        style={{ backgroundImage: `url('${bgImage}')` }}
      />
      <div className="bg-carbon-950/35 absolute inset-0" />
      <PointerSpotlight />
      <div className="quant-noise-overlay" />
      <div className="quant-vignette-overlay" />
      <header
        data-tauri-drag-region
        className="vt-header border-brass-600/15 bg-espresso-950/75 relative z-10 flex items-center justify-between border-b px-6 py-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.4)] select-none"
      >
        <div className="flex items-center gap-2.5" data-tauri-drag-region>
          <QuantEmblem className="h-10 w-10" />
          <img
            src="/quant-logo-text.png"
            alt="QUANT"
            className="block h-3.5 w-auto object-contain select-none"
          />
          <div className="bg-brass-600/25 h-5 w-px" />
          <span className="text-silver-300 font-mono text-[10px] font-semibold tracking-wider uppercase">
            {title}
          </span>
        </div>
        <div className="flex h-full items-center gap-6">
          <BrightnessToggle />
          <div className="border-brass-600/30 bg-brass-600/10 text-brass-400 flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase shadow-[0_0_10px_rgba(196,165,116,0.05)]">
            <span className="bg-brass-400 h-1 w-1 animate-pulse rounded-full" />
            {tag}
          </div>
          <WindowControls />
        </div>
      </header>
      <main
        className={
          mainClassName ?? 'animate-fade-in-up relative z-10 flex-1 overflow-auto px-6 py-6'
        }
      >
        {children}
      </main>
    </div>
  )
}
