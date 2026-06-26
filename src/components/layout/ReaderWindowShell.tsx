import type { ReactNode } from 'react'

import { PointerSpotlight } from '@/components/effects/PointerSpotlight'
import { WindowControls } from '@/components/layout/WindowControls'
import { BrightnessToggle } from '@/components/layout/BrightnessToggle'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'
import { cn } from '@/lib/utils'

type ReaderWindowShellProps = {
  children: ReactNode
  title?: string
  tag?: string
  mainClassName?: string
}

const BLACK_BG_MAP = {
  high: '/high_brightness/Quant_Background_Black_High_Brightness.jpeg',
  mid: '/mid_brightness/Quant_Background_Black_Mid_Brightness.jpeg',
  low: '/mid_brightness/Quant_Background_Black_Mid_Brightness.jpeg',
}

function PhasePill({ label }: { label: string }) {
  return (
    <div
      className={cn(
        'surface-card accent-state flex items-center gap-1.5 rounded-full border px-3 py-1',
      )}
    >
      <span className="live-status-dot bg-brass-400 h-1 w-1 rounded-full" aria-hidden />
      <span className="accent-wayfinding font-mono text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </span>
    </div>
  )
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
        className="vt-header surface-shell surface-shell--blur relative z-10 flex items-center justify-between border-b px-6 py-2.5 select-none"
      >
        <div className="flex items-center gap-2.5" data-tauri-drag-region>
          <img
            src="/quant-logo-text.png"
            alt="QUANT"
            className="block h-3.5 w-auto object-contain select-none"
          />
          <div className="bg-brass-600/25 h-5 w-px" />
          <span className="accent-wayfinding font-mono text-[10px] font-semibold tracking-wider uppercase">
            {title}
          </span>
        </div>
        <div className="flex h-full items-center gap-6">
          <BrightnessToggle />
          <PhasePill label={tag} />
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
