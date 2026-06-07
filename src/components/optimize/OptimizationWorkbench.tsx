import { ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'

import { workbenchCollapse, workbenchTransition } from '@/lib/motion'
import { cn } from '@/lib/utils'

const HANDLE_WIDTH = 40
const PANEL_WIDTH = 'clamp(450px, 42vw, 600px)'

type OptimizationWorkbenchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function OptimizationWorkbench({
  open,
  onOpenChange,
  children,
}: OptimizationWorkbenchProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close optimization workbench"
          className="bg-carbon-950/60 fixed inset-0 z-10 md:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      <div className="relative z-20 flex h-full shrink-0">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Collapse optimization workbench' : 'Expand optimization workbench'}
          onClick={() => onOpenChange(!open)}
          className={cn(
            'quant-panel border-carbon-600/60 flex shrink-0 flex-col items-center justify-center gap-2 border-r py-4',
            'hover:bg-carbon-800/40 transition-colors',
          )}
          style={{ width: HANDLE_WIDTH }}
        >
          {open ? (
            <ChevronLeft className="text-silver-400 h-4 w-4" />
          ) : (
            <SlidersHorizontal className="text-brass-400 h-4 w-4" />
          )}
          <span className="text-silver-500 rotate-180 text-[10px] tracking-wider uppercase [writing-mode:vertical-rl]">
            Config
          </span>
        </button>

        <motion.div
          initial={false}
          animate={{
            width: open ? PANEL_WIDTH : 0,
            opacity: open ? 1 : 0,
          }}
          transition={open ? workbenchTransition : workbenchCollapse}
          className={cn(
            'border-carbon-600/60 quant-panel shrink-0 overflow-hidden border-r',
            open && 'fixed inset-y-0 left-0 z-20 md:relative md:inset-auto',
          )}
          style={{ maxHeight: '100%' }}
        >
          <div className="flex h-full flex-col overflow-hidden" style={{ width: PANEL_WIDTH }}>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
