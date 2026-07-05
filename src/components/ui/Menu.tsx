import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { AnimatePresence, motion } from 'motion/react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { cn } from '@/lib/utils'

const MenuContext = createContext<{ open: boolean }>({ open: false })

export function Menu({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen,
  ...props
}: DropdownMenuPrimitive.DropdownMenuProps) {
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
    <DropdownMenuPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
      <MenuContext.Provider value={{ open }}>{children}</MenuContext.Provider>
    </DropdownMenuPrimitive.Root>
  )
}

export const MenuTrigger = DropdownMenuPrimitive.Trigger
export const MenuPortal = DropdownMenuPrimitive.Portal
export const MenuSub = DropdownMenuPrimitive.Sub

export const MenuSubTrigger = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'text-silver-300 focus:text-silver-100 flex cursor-default items-center rounded px-2 py-1.5 text-xs outline-none select-none focus:bg-white/5 data-[state=open]:bg-white/5',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.SubTrigger>
))
MenuSubTrigger.displayName = 'MenuSubTrigger'

export const MenuSubContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'surface-float surface-float--blur border-carbon-700/60 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-xl',
      className,
    )}
    {...props}
  />
))
MenuSubContent.displayName = 'MenuSubContent'

export const MenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, children, sideOffset = 4, ...props }, ref) => {
  const { open } = useContext(MenuContext)
  const reduced = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <MenuPortal forceMount>
          <DropdownMenuPrimitive.Content
            asChild
            ref={ref}
            forceMount
            sideOffset={sideOffset}
            {...props}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={{
                hidden: { opacity: 0, scale: reduced ? 1 : 0.96 },
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
                  scale: reduced ? 1 : 0.96,
                  transition: {
                    duration: reduced ? 0 : 0.12,
                    ease: [0.4, 0, 1, 1],
                  },
                },
              }}
              className={cn(
                'surface-float surface-float--blur z-50 min-w-[12rem] overflow-hidden rounded-md p-1 focus:outline-none',
                'data-[side=bottom]:origin-top data-[side=left]:origin-right data-[side=right]:origin-left data-[side=top]:origin-bottom',
                className,
              )}
            >
              {children}
            </motion.div>
          </DropdownMenuPrimitive.Content>
        </MenuPortal>
      )}
    </AnimatePresence>
  )
})
MenuContent.displayName = 'MenuContent'

export const MenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    shortcut?: string
    destructive?: boolean
  }
>(({ className, children, shortcut, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-between rounded px-2 py-1.5 text-xs transition-colors outline-none select-none focus:bg-white/5',
      destructive
        ? 'text-rose-400 focus:bg-rose-500/10 focus:text-rose-300'
        : 'text-silver-300 focus:text-silver-100',
      className,
    )}
    {...props}
  >
    <div className="flex items-center gap-2">{children}</div>
    {shortcut && (
      <span className="ml-auto font-mono text-[10px] tracking-widest opacity-60">{shortcut}</span>
    )}
  </DropdownMenuPrimitive.Item>
))
MenuItem.displayName = 'MenuItem'

export const MenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('bg-carbon-800/60 my-1 h-px', className)}
    {...props}
  />
))
MenuSeparator.displayName = 'MenuSeparator'
