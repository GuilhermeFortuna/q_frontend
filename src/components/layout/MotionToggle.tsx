import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles, Zap } from 'lucide-react'

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

export function MotionToggle() {
  const motionMode = useAppStore((s) => s.motionMode)
  const setMotionMode = useAppStore((s) => s.setMotionMode)
  const particleSpeedMode = useAppStore((s) => s.particleSpeedMode ?? 'normal')
  const particleColorMode = useAppStore((s) => s.particleColorMode ?? 'gold')
  const setParticleSpeedMode = useAppStore((s) => s.setParticleSpeedMode)
  const setParticleColorMode = useAppStore((s) => s.setParticleColorMode)
  const reduced = usePrefersReducedMotion()

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggleMotion = () => {
    setMotionMode(motionMode === 'full' ? 'system' : 'full')
  }

  const speedOptions = [
    { value: 'zero-g', label: 'Zero-G', desc: '0.1x drift' },
    { value: 'normal', label: 'Drift', desc: '1.0x normal' },
    { value: 'hyper', label: 'Warp', desc: '5.0x speed' },
    { value: 'reverse', label: 'Reverse', desc: '-1.0x flow' },
  ] as const

  const colorOptions = [
    { value: 'gold', label: 'Amber', class: 'bg-amber-500 shadow-amber-500/50' },
    { value: 'cyan', label: 'Quantum', class: 'bg-cyan-400 shadow-cyan-400/50' },
    { value: 'violet', label: 'Orchid', class: 'bg-purple-500 shadow-purple-500/50' },
    { value: 'silver', label: 'Silver', class: 'bg-slate-300 shadow-slate-300/50' },
  ] as const

  return (
    <div ref={containerRef} className="relative h-8 w-8">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'surface-control accent-interactive flex h-full w-full cursor-pointer items-center justify-center rounded-lg border',
          'focus-visible:outline-brass-500 transition-[transform,box-shadow,border-color] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95',
          isOpen ? 'border-brass-500/80 shadow-[0_0_8px_rgba(217,158,34,0.3)]' : '',
        )}
        title="Adjust background particle effects"
        aria-label="Toggle background particle settings"
        aria-expanded={isOpen}
      >
        <Sparkles
          className={cn(
            'h-4 w-4 transition-all duration-300',
            motionMode === 'full' ? 'text-brass-400 scale-105' : 'text-silver-400 opacity-60',
          )}
        />
      </button>

      {/* Popover Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="surface-panel border-brass-600/15 absolute top-12 right-0 z-50 w-72 min-w-[288px] origin-top-right rounded-2xl border p-4 shadow-[0_15px_35px_rgba(0,0,0,0.85),_0_0_25px_rgba(217,158,34,0.02)]"
          >
            {/* Menu Title */}
            <div className="border-brass-600/15 border-b pb-2">
              <span className="text-silver-100 font-mono text-[9px] font-bold tracking-widest uppercase">
                Aesthetic Settings
              </span>
              <p className="text-silver-500 mt-0.5 font-mono text-[8px] tracking-wider uppercase">
                Background Particles Modulator
              </p>
            </div>

            <div className="mt-3.5 space-y-4">
              {/* Master Motion Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-silver-200 font-mono text-[9px] font-bold tracking-wider uppercase">
                    Ambient Motion
                  </span>
                  <span className="text-silver-500 text-[8px] tracking-wide">
                    {motionMode === 'full'
                      ? 'Running full speed'
                      : `System settings (${reduced ? 'reduced' : 'full'})`}
                  </span>
                </div>
                <button
                  onClick={handleToggleMotion}
                  className={cn(
                    'surface-control hover:border-brass-500/30 flex cursor-pointer items-center justify-center rounded-lg border px-2 py-1 font-mono text-[9px] font-bold tracking-wider uppercase transition-all active:scale-95',
                    motionMode === 'full'
                      ? 'border-brass-500 bg-brass-500/5 text-brass-400'
                      : 'text-silver-400 hover:text-silver-100',
                  )}
                >
                  {motionMode === 'full' ? 'Full' : 'System'}
                </button>
              </div>

              {/* Colors Modulator */}
              <div className="space-y-1.5">
                <span className="text-silver-400 block font-mono text-[9px] font-bold tracking-wider uppercase">
                  Cosmic Palette
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setParticleColorMode(opt.value)}
                      className={cn(
                        'surface-control hover:border-brass-500/30 flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all active:scale-95',
                        particleColorMode === opt.value
                          ? 'border-brass-500 bg-brass-500/5 text-brass-400 font-semibold'
                          : 'text-silver-300 hover:text-silver-100',
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full shadow-sm', opt.class)} />
                      <span className="font-mono text-[9px] font-bold tracking-tight">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Modulator */}
              <div className="space-y-1.5">
                <span className="text-silver-400 block font-mono text-[9px] font-bold tracking-wider uppercase">
                  Drift Dynamics
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {speedOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setParticleSpeedMode(opt.value)}
                      className={cn(
                        'surface-control hover:border-brass-500/30 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-1.5 transition-all active:scale-95',
                        particleSpeedMode === opt.value
                          ? 'border-brass-500 bg-brass-500/5 text-brass-400 font-semibold'
                          : 'text-silver-300 hover:text-silver-100',
                      )}
                      title={opt.desc}
                    >
                      {opt.value === 'hyper' && <Zap className="text-brass-400 h-3 w-3" />}
                      <span className="font-mono text-[9px]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
