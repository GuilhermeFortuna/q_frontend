import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react'

import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { cn } from '@/lib/utils'

export type PowerOffSlideState =
  | 'idle'
  | 'dragging'
  | 'armed'
  | 'submitting'
  | 'confirmed'
  | 'rejected'

export type PowerOffSlideProps = {
  disabled?: boolean
  submitting?: boolean
  confirmed?: boolean
  rejected?: boolean
  onConfirm: () => void
  className?: string
}

const THRESHOLD_RATIO = 0.88
const THUMB_SIZE = 44
const TRACK_INSET = 4
const KEY_STEP = 5
const MAX_TRACK_WIDTH = 320

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function percentFromOffset(offset: number, maxTravel: number): number {
  if (maxTravel <= 0) return 0
  return Math.round((offset / maxTravel) * 100)
}

function statusCopy(state: PowerOffSlideState, value: number): string {
  switch (state) {
    case 'idle':
      return 'Slide to engage kill switch'
    case 'dragging':
      return `Intent ${value}%`
    case 'armed':
      return 'Armed — release or press Enter to engage'
    case 'submitting':
      return 'Awaiting control plane'
    case 'confirmed':
      return 'Kill switch engaged'
    case 'rejected':
      return 'Engagement rejected'
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}

export function PowerOffSlide({
  disabled = false,
  submitting = false,
  confirmed = false,
  rejected = false,
  onConfirm,
  className,
}: PowerOffSlideProps) {
  const labelId = useId()
  const statusId = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const confirmedRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const dragOriginRef = useRef(0)
  const offsetAtPointerDownRef = useRef(0)
  const maxTravelRef = useRef(0)
  const lockedRef = useRef(false)
  const phaseRef = useRef<PowerOffSlideState>('idle')
  const onConfirmRef = useRef(onConfirm)

  const [maxTravel, setMaxTravel] = useState(0)
  const [phase, setPhase] = useState<PowerOffSlideState>('idle')
  const [value, setValue] = useState(0)

  const x = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  const reduceMotionRef = useRef(reduceMotion)
  reduceMotionRef.current = reduceMotion

  const locked = disabled || submitting || confirmed || phase === 'submitting'
  lockedRef.current = locked
  phaseRef.current = phase
  onConfirmRef.current = onConfirm
  maxTravelRef.current = maxTravel

  useMotionValueEvent(x, 'change', (latest) => {
    const thumb = thumbRef.current
    if (thumb) {
      thumb.style.transform = `translateX(${latest}px)`
    }
    const travel = maxTravelRef.current
    if (travel <= 0) return
    if (phaseRef.current === 'dragging') {
      setValue(percentFromOffset(latest, travel))
    }
  })

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const width = track.clientWidth
    const travel = Math.max(0, width - THUMB_SIZE - TRACK_INSET * 2)
    maxTravelRef.current = travel
    setMaxTravel(travel)
  }, [])

  useLayoutEffect(() => {
    measure()
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(track)
    return () => observer.disconnect()
  }, [measure])

  const snapTo = useCallback(
    (offset: number, nextPhase: PowerOffSlideState) => {
      const travel = maxTravelRef.current
      const clamped = clamp(offset, 0, travel)
      setValue(percentFromOffset(clamped, travel))
      setPhase(nextPhase)
      phaseRef.current = nextPhase
      if (reduceMotionRef.current) {
        x.set(clamped)
        return
      }
      void animate(x, clamped, { type: 'spring', duration: 0.25, bounce: 0 })
    },
    [x],
  )

  const snapToRef = useRef(snapTo)
  snapToRef.current = snapTo

  const fireConfirmOnce = useCallback(() => {
    if (confirmedRef.current || lockedRef.current) return
    confirmedRef.current = true
    setPhase('submitting')
    phaseRef.current = 'submitting'
    onConfirmRef.current()
  }, [])

  useEffect(() => {
    if (submitting) {
      setPhase('submitting')
      phaseRef.current = 'submitting'
    }
  }, [submitting])

  useEffect(() => {
    if (confirmed) {
      snapTo(maxTravelRef.current, 'confirmed')
    }
  }, [confirmed, snapTo])

  const prevRejectedRef = useRef(false)
  useEffect(() => {
    const rising = rejected && !prevRejectedRef.current
    prevRejectedRef.current = rejected
    if (!rising) return
    confirmedRef.current = false
    snapTo(0, 'rejected')
    const timer = window.setTimeout(() => {
      setPhase('idle')
      phaseRef.current = 'idle'
    }, reduceMotion ? 0 : 120)
    return () => window.clearTimeout(timer)
  }, [rejected, reduceMotion, snapTo])

  const setOffsetFromPointer = (clientX: number) => {
    const travel = maxTravelRef.current
    if (travel <= 0) return 0
    const next = clamp(
      offsetAtPointerDownRef.current + (clientX - dragOriginRef.current),
      0,
      travel,
    )
    x.set(next)
    setValue(percentFromOffset(next, travel))
    return next
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lockedRef.current) return
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    dragOriginRef.current = event.clientX
    offsetAtPointerDownRef.current = x.get()
    setPhase('dragging')
    phaseRef.current = 'dragging'
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // jsdom may not implement capture
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || lockedRef.current) return
    setOffsetFromPointer(event.clientX)
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // already released / unsupported
    }

    if (cancelled || lockedRef.current) {
      snapToRef.current(0, 'idle')
      return
    }

    const travel = maxTravelRef.current
    const offset = setOffsetFromPointer(event.clientX)
    const ratio = travel > 0 ? offset / travel : 0
    if (ratio >= THRESHOLD_RATIO) {
      snapToRef.current(travel, 'armed')
      fireConfirmOnce()
    } else {
      snapToRef.current(0, 'idle')
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (lockedRef.current && event.key !== 'Tab') return

    const travel = maxTravelRef.current
    const current = x.get()
    const step = (travel * KEY_STEP) / 100

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp': {
        event.preventDefault()
        if (lockedRef.current) return
        const next = clamp(current + step, 0, travel)
        snapTo(next, travel > 0 && next / travel >= THRESHOLD_RATIO ? 'armed' : 'dragging')
        break
      }
      case 'ArrowLeft':
      case 'ArrowDown': {
        event.preventDefault()
        if (lockedRef.current) return
        const next = clamp(current - step, 0, travel)
        snapTo(
          next,
          next <= 0 ? 'idle' : travel > 0 && next / travel >= THRESHOLD_RATIO ? 'armed' : 'dragging',
        )
        break
      }
      case 'Home': {
        event.preventDefault()
        if (lockedRef.current) return
        snapTo(0, 'idle')
        break
      }
      case 'End': {
        event.preventDefault()
        if (lockedRef.current) return
        snapTo(travel, 'armed')
        break
      }
      case 'Enter':
      case ' ': {
        event.preventDefault()
        if (lockedRef.current) return
        if (
          phaseRef.current === 'armed' ||
          (travel > 0 && current / travel >= THRESHOLD_RATIO)
        ) {
          snapTo(travel, 'armed')
          fireConfirmOnce()
        }
        break
      }
      default:
        break
    }
  }

  const resolvedPhase: PowerOffSlideState = confirmed
    ? 'confirmed'
    : submitting
      ? 'submitting'
      : phase === 'rejected'
        ? 'rejected'
        : phase

  const instruction = statusCopy(resolvedPhase, value)
  const nearThreshold = value >= Math.round(THRESHOLD_RATIO * 100)
  const markerLeft =
    maxTravel > 0 ? TRACK_INSET + maxTravel * THRESHOLD_RATIO + THUMB_SIZE / 2 : TRACK_INSET

  return (
    <div
      className={cn('flex w-full max-w-[320px] flex-col gap-1.5', className)}
      data-testid="power-off-slide"
      data-state={resolvedPhase}
    >
      <p id={labelId} className="text-silver-400 text-xs" aria-hidden="true">
        Slide past the brass marker to engage the global kill switch.
      </p>

      <div
        ref={trackRef}
        className={cn(
          'surface-well relative h-12 w-full overflow-hidden rounded-lg border',
          nearThreshold || resolvedPhase === 'armed' || resolvedPhase === 'submitting'
            ? 'border-rose-500/35'
            : 'border-carbon-700/50',
          locked ? 'opacity-80' : null,
        )}
        style={{ maxWidth: MAX_TRACK_WIDTH }}
      >
        <div
          aria-hidden
          className="bg-brass-500/70 absolute top-1.5 bottom-1.5 w-px"
          style={{ left: markerLeft }}
          data-testid="power-off-slide-marker"
        />

        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 rounded-lg transition-[width] duration-75',
            nearThreshold ? 'bg-rose-500/10' : 'bg-brass-500/5',
          )}
          style={{
            width:
              maxTravel > 0
                ? TRACK_INSET + (value / 100) * maxTravel + THUMB_SIZE
                : THUMB_SIZE + TRACK_INSET,
          }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14">
          <span className="text-silver-400 quant-tabular-nums truncate text-xs font-medium">
            {resolvedPhase === 'submitting'
              ? 'Awaiting control plane'
              : resolvedPhase === 'armed'
                ? 'Armed'
                : `${value}%`}
          </span>
        </div>

        <div
          ref={thumbRef}
          role="slider"
          tabIndex={disabled || confirmed ? -1 : 0}
          aria-describedby={`${labelId} ${statusId}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-disabled={locked || undefined}
          aria-label="Engage global kill switch"
          data-testid="power-off-slide-thumb"
          className={cn(
            'surface-suede absolute top-1 left-1 z-10 flex items-center justify-center rounded-md border',
            'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            nearThreshold || resolvedPhase === 'armed' || resolvedPhase === 'submitting'
              ? 'border-rose-500/45'
              : 'border-carbon-600/60',
            locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
          )}
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            touchAction: 'none',
            willChange: 'transform',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => finishPointer(event, false)}
          onPointerCancel={(event) => finishPointer(event, true)}
          onKeyDown={onKeyDown}
        >
          <span
            aria-hidden
            className={cn(
              'h-2 w-2 rounded-sm',
              nearThreshold || resolvedPhase === 'armed' ? 'bg-rose-400' : 'bg-silver-400',
            )}
          />
        </div>
      </div>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="text-silver-400 quant-tabular-nums text-2xs min-h-[1rem]"
        data-testid="power-off-slide-status"
      >
        {instruction}
      </p>
    </div>
  )
}
