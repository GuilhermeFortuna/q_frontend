import { useStreamStatus } from '@/lib/stream/jobStreamContext'

export function LiveUpdatesIndicator() {
  const status = useStreamStatus()
  if (status !== 'unavailable') return null

  return (
    <span
      role="status"
      className="surface-control text-silver-300 border-brass-600/15 rounded-lg border px-2 py-1 font-mono text-[9px] tracking-wider"
    >
      Live updates unavailable
    </span>
  )
}
