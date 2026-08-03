import { useRef, type ReactNode, type RefObject } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { cn } from '@/lib/utils'

const LAYOUT_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]
const LAYOUT_DURATION = 0.28
const SCRIM_DURATION = 0.12

function layoutTransition(reduced: boolean) {
  return {
    duration: reduced ? 0 : LAYOUT_DURATION,
    ease: LAYOUT_EASE,
  } as const
}

export type MorphingDialogTriggerProps = {
  layoutId: string
  children: ReactNode
  className?: string
}

/**
 * Shared-layout origin. Place in the activating row/card; pair with {@link MorphingDialog}
 * using the same `layoutId`. Under reduced motion, layoutId is omitted.
 */
export function MorphingDialogTrigger({
  layoutId,
  children,
  className,
}: MorphingDialogTriggerProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      layoutId={reduced ? undefined : layoutId}
      transition={layoutTransition(reduced)}
      className={cn('relative', className)}
      style={{ borderRadius: 8 }}
    >
      {children}
    </motion.div>
  )
}

export type MorphingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  layoutId: string
  children: ReactNode
  title: string
  description?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Called instead of default focus restoration when the dialog closes. */
  onCloseAutoFocus?: (event: Event) => void
  /** Fires after the exit animation finishes (or immediately under reduced motion). */
  onExitComplete?: () => void
  contentClassName?: string
  showCloseButton?: boolean
}

/**
 * Shared-element inspection overlay: Motion morphs `layoutId` from {@link MorphingDialogTrigger}
 * into this content shell; Radix owns portal, focus trap, Escape, outside-dismiss, and ARIA.
 * Adapted from Motion Primitives Morphing Dialog — provider focus/click-outside helpers omitted.
 */
export function MorphingDialog({
  open,
  onOpenChange,
  layoutId,
  children,
  title,
  description,
  initialFocusRef,
  onCloseAutoFocus,
  onExitComplete,
  contentClassName,
  showCloseButton = true,
}: MorphingDialogProps) {
  const reduced = useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)
  const sharedLayoutId = reduced ? undefined : layoutId
  const transition = layoutTransition(reduced)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence onExitComplete={onExitComplete}>
        {open ? (
          <DialogPrimitive.Portal forceMount key={`morph-portal-${layoutId}`}>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                key={`morph-scrim-${layoutId}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : SCRIM_DURATION }}
                className="surface-overlay-scrim fixed inset-0 z-50"
              />
            </DialogPrimitive.Overlay>

            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
              <DialogPrimitive.Content
                asChild
                forceMount
                onOpenAutoFocus={(event) => {
                  if (initialFocusRef?.current) {
                    event.preventDefault()
                    initialFocusRef.current.focus()
                  }
                }}
                onCloseAutoFocus={(event) => {
                  if (onCloseAutoFocus) {
                    onCloseAutoFocus(event)
                  }
                }}
              >
                <motion.div
                  ref={contentRef}
                  key={`morph-content-${layoutId}`}
                  layoutId={sharedLayoutId}
                  transition={transition}
                  className={cn(
                    'surface-overlay pointer-events-auto flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl',
                    contentClassName,
                  )}
                  style={{ borderRadius: 12 }}
                  data-testid="morphing-dialog-content"
                >
                  <div className="border-carbon-800/60 flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
                    <div className="min-w-0 space-y-1">
                      <DialogPrimitive.Title asChild>
                        <h2 className="accent-wayfinding text-[11px] font-[560] tracking-[0.08em] uppercase">
                          {title}
                        </h2>
                      </DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="text-silver-400 text-xs">
                          {description}
                        </DialogPrimitive.Description>
                      ) : (
                        <DialogPrimitive.Description className="sr-only">
                          Detail inspector
                        </DialogPrimitive.Description>
                      )}
                    </div>
                    {showCloseButton ? (
                      <DialogPrimitive.Close
                        type="button"
                        className="text-silver-400 hover:text-silver-100 focus-visible:ring-brass-500/50 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        aria-label="Close"
                        data-testid="morphing-dialog-close"
                      >
                        <X className="h-4 w-4" />
                      </DialogPrimitive.Close>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                    {children}
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
