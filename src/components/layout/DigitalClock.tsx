import { useEffect, useState } from 'react'

export function DigitalClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Format time: HH:MM:SS
  const formatTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    const seconds = pad(date.getSeconds())
    return `${hours}:${minutes}:${seconds}`
  }

  // Format date: EEE, MMM dd
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      data-tauri-no-drag
      className="surface-shell border-brass-600/15 flex items-center gap-3 rounded-full border px-3.5 py-1.5 transition-colors duration-300"
    >
      <span className="text-silver-300 font-sans text-[10px] font-medium tracking-wider uppercase">
        {formatDate(time)}
      </span>
      <span className="bg-brass-600/20 h-3 w-[1px]" />
      <span className="text-brass-400 quant-tabular-nums font-mono text-xs font-semibold tracking-wider [text-shadow:0_0_8px_rgba(240,180,41,0.2)]">
        {formatTime(time)}
      </span>
    </div>
  )
}
