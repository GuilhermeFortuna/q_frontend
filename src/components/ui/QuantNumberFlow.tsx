import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { cn } from '@/lib/utils'

const EM_DASH = '—'
const FLOW_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const Y_OFFSET = 12
const DEFAULT_DURATION_MS = 220
const MIN_DURATION_MS = 120
const MAX_DURATION_MS = 280
const TINT_UP = '#34d399'
const TINT_DOWN = '#fb7185'

export type QuantNumberFlowProps = {
  value: number
  format: (value: number) => string
  direction?: 'auto' | 'up' | 'down'
  /** Default 220; clamped to 120..280. */
  durationMs?: number
  ariaLabel?: string
  className?: string
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

function clampDurationMs(ms: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, ms))
}

function resolveDirectionSign(
  direction: 'auto' | 'up' | 'down',
  next: number,
  prev: number,
): 1 | -1 {
  switch (direction) {
    case 'up':
      return 1
    case 'down':
      return -1
    case 'auto': {
      if (!Number.isFinite(next) || !Number.isFinite(prev) || next === prev) return 1
      return next > prev ? 1 : -1
    }
    default: {
      const _exhaustive: never = direction
      return _exhaustive
    }
  }
}

function shouldSnapMotion(reduced: boolean): boolean {
  if (reduced) return true
  if (typeof document === 'undefined') return false
  return document.hidden
}

/**
 * Direction-aware tabular digit flow for live KPI values.
 * Adapted from SmoothUI Number Flow — counter chrome discarded; Motion character slots retain
 * the vertical directional digit signature with caller-owned formatters.
 */
export function QuantNumberFlow({
  value,
  format,
  direction = 'auto',
  durationMs = DEFAULT_DURATION_MS,
  ariaLabel,
  className,
}: QuantNumberFlowProps) {
  const reduced = useReducedMotion()
  const prevValueRef = useRef(value)
  const directionSignRef = useRef<1 | -1>(1)

  if (value !== prevValueRef.current) {
    directionSignRef.current = resolveDirectionSign(direction, value, prevValueRef.current)
    prevValueRef.current = value
  }

  const finite = Number.isFinite(value)
  const formatted = finite ? format(value) : EM_DASH
  const accessible = ariaLabel ?? (finite ? formatted : undefined)
  const snap = shouldSnapMotion(reduced)
  const durationSec = snap ? 0 : clampDurationMs(durationMs) / 1000
  const dir = directionSignRef.current
  const tint = dir > 0 ? TINT_UP : TINT_DOWN

  return (
    <span
      className={cn('quant-number-flow inline-flex tabular-nums', className)}
      aria-label={accessible}
      data-quant-number-flow=""
      data-value={finite ? String(value) : undefined}
    >
      {/* Single final formatted string for copy/SR; animated glyphs are decorative. */}
      <span data-quant-number-flow-text="" className="sr-only">
        {finite ? formatted : EM_DASH}
      </span>
      <span aria-hidden="true" className="inline-flex items-baseline select-none">
        {formatted.split('').map((char, index) => {
          if (!isDigit(char)) {
            return (
              <span key={`s-${index}-${char}`} className="inline-block">
                {char}
              </span>
            )
          }

          return (
            <span
              key={`d-${index}`}
              className="relative inline-block overflow-hidden"
              style={{ height: '1em', minWidth: '1ch' }}
            >
              <AnimatePresence initial={false}>
                <motion.span
                  key={`${index}-${char}`}
                  className="absolute inset-0 flex items-center justify-center"
                  initial={snap ? false : { y: Y_OFFSET * dir, opacity: 0, color: tint }}
                  animate={{ y: 0, opacity: 1, color: 'currentColor' }}
                  exit={snap ? undefined : { y: -Y_OFFSET * dir, opacity: 0, color: tint }}
                  transition={{ duration: durationSec, ease: FLOW_EASE }}
                >
                  {char}
                </motion.span>
              </AnimatePresence>
            </span>
          )
        })}
      </span>
    </span>
  )
}
