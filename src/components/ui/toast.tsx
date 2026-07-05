import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { fadeRise, overlayExit } from '@/lib/motion/presets'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  description?: string
  duration?: number
}

type ToastListener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
const listeners = new Set<ToastListener>()

function notify() {
  listeners.forEach((listener) => listener(toasts))
}

export const toast = {
  add: (
    type: ToastType,
    message: string,
    options?: { description?: string; duration?: number },
  ) => {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = options?.duration ?? (type === 'error' ? 8000 : 5000)

    toasts = [...toasts, { id, type, message, description: options?.description, duration }].slice(
      -3,
    ) // Cap at 3 visible
    notify()

    return id
  },
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  },
  success: (message: string, options?: { description?: string; duration?: number }) => {
    return toast.add('success', message, options)
  },
  error: (message: string, options?: { description?: string; duration?: number }) => {
    return toast.add('error', message, options)
  },
  info: (message: string, options?: { description?: string; duration?: number }) => {
    return toast.add('info', message, options)
  },
  subscribe: (listener: ToastListener) => {
    listeners.add(listener)
    listener(toasts)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Test helper — clears the active toast stack. */
  resetForTests: () => {
    toasts = []
    notify()
  },
}

export function useToasts() {
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return toast.subscribe(setActiveToasts)
  }, [])

  return activeToasts
}

function ToastCard({ item }: { item: ToastItem }) {
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (hovered) return
    const timer = setTimeout(() => {
      toast.dismiss(item.id)
    }, item.duration ?? 5000)
    return () => clearTimeout(timer)
  }, [hovered, item.duration, item.id])

  const iconMap = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }
  const Icon = iconMap[item.type]

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={{
        ...fadeRise(reduced),
        ...overlayExit(reduced),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'surface-overlay border-carbon-700/60 pointer-events-auto relative flex w-80 gap-3 overflow-hidden rounded-xl border p-4 shadow-2xl',
        item.type === 'success' && 'border-l-brass-500 border-l-4',
        item.type === 'error' && 'border-l-4 border-l-rose-500',
        item.type === 'info' && 'border-l-4 border-l-sky-500',
      )}
      data-testid={`toast-${item.type}`}
    >
      <Icon
        className={cn(
          'mt-0.5 h-5 w-5 shrink-0',
          item.type === 'success' && 'text-brass-400',
          item.type === 'error' && 'text-rose-400',
          item.type === 'info' && 'text-sky-400',
        )}
      />
      <div className="flex-1 space-y-1">
        <h5 className="text-silver-100 text-xs leading-relaxed font-semibold">{item.message}</h5>
        {item.description && (
          <p className="text-silver-400 text-[10px] leading-relaxed">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(item.id)}
        className="text-silver-500 hover:text-silver-300 self-start rounded p-0.5 transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

export function Toaster() {
  const activeToasts = useToasts()

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {activeToasts.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}
