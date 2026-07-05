import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { AnimatePresence, motion } from 'motion/react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { cn } from '@/lib/utils'

const PopoverContext = createContext<{ open: boolean }>({ open: false })

export function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen,
  ...props
}: PopoverPrimitive.PopoverProps) {
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
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
      <PopoverContext.Provider value={{ open }}>{children}</PopoverContext.Provider>
    </PopoverPrimitive.Root>
  )
}

export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverPortal = PopoverPrimitive.Portal

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, children, align = 'center', sideOffset = 4, ...props }, ref) => {
  const { open } = useContext(PopoverContext)
  const reduced = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <PopoverPortal forceMount>
          <PopoverPrimitive.Content
            asChild
            ref={ref}
            forceMount
            align={align}
            sideOffset={sideOffset}
            collisionPadding={8}
            {...props}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={{
                hidden: { opacity: 0, scale: reduced ? 1 : 0.95 },
                visible: {
                  opacity: 1,
                  scale: 1,
                  transition: {
                    duration: reduced ? 0 : 0.18,
                    ease: [0.16, 1, 0.3, 1],
                  },
                },
                exit: {
                  opacity: 0,
                  scale: reduced ? 1 : 0.95,
                  transition: {
                    duration: reduced ? 0 : 0.12,
                    ease: [0.4, 0, 1, 1],
                  },
                },
              }}
              className={cn(
                'surface-float surface-float--blur z-50 min-w-[200px] rounded-lg p-4 focus:outline-none',
                'data-[side=bottom]:origin-top data-[side=left]:origin-right data-[side=right]:origin-left data-[side=top]:origin-bottom',
                className,
              )}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPortal>
      )}
    </AnimatePresence>
  )
})
PopoverContent.displayName = 'PopoverContent'
