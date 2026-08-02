import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { overlayEnter, overlayExit } from '@/lib/motion/presets'
import { cn } from '@/lib/utils'

const DialogContext = createContext<{ open: boolean }>({ open: false })

export function Dialog({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen,
  ...props
}: DialogPrimitive.DialogProps) {
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : localOpen

  const handleOpenChange = (val: boolean) => {
    if (!isControlled) {
      setLocalOpen(val)
    }
    onOpenChange?.(val)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
      <DialogContext.Provider value={{ open }}>{children}</DialogContext.Provider>
    </DialogPrimitive.Root>
  )
}

export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export type DialogContentProps = {
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
} & ComponentPropsWithoutRef<typeof DialogPrimitive.Content>

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size = 'md', ...props }, ref) => {
  const { open } = useContext(DialogContext)
  const reduced = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <DialogPortal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.12 }}
              className="surface-overlay-scrim fixed inset-0 z-50"
            />
          </DialogPrimitive.Overlay>
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <DialogPrimitive.Content asChild ref={ref} forceMount {...props}>
              <motion.div
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={{
                  ...overlayEnter(reduced),
                  ...overlayExit(reduced),
                }}
                className={cn(
                  'surface-overlay pointer-events-auto flex w-full flex-col rounded-xl p-5',
                  size === 'sm' && 'max-w-sm',
                  size === 'md' && 'max-w-md',
                  size === 'lg' && 'max-w-lg',
                  className,
                )}
              >
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </DialogPortal>
      )}
    </AnimatePresence>
  )
})
DialogContent.displayName = 'DialogContent'

export function DialogHeader({
  title,
  right,
  className,
}: {
  title: string
  right?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-carbon-800/60 mb-4 flex items-center justify-between gap-3 border-b pb-3',
        className,
      )}
    >
      <DialogPrimitive.Title asChild>
        <h3 className="accent-wayfinding text-[11px] font-[560] tracking-[0.08em] uppercase">
          {title}
        </h3>
      </DialogPrimitive.Title>
      {right ? <div className="text-silver-400 text-xs">{right}</div> : null}
    </div>
  )
}

export const DialogDescription = DialogPrimitive.Description
