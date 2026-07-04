import { useEffect, useState } from 'react'

export function DigitalClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Format time components
  const pad = (n: number) => String(n).padStart(2, '0')
  const hours = pad(time.getHours())
  const minutes = pad(time.getMinutes())
  const seconds = pad(time.getSeconds())

  // Date formatting: "FRI" and "04 JUL"
  const weekday = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const day = time.toLocaleDateString('en-US', { day: '2-digit' })
  const month = time.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()

  // Get short timezone name
  const getTimezone = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(time)
      return parts.find((p) => p.type === 'timeZoneName')?.value || 'SYS'
    } catch {
      return 'SYS'
    }
  }

  return (
    <div
      data-tauri-no-drag
      className="group hover:border-brass-500/40 relative flex h-[30px] cursor-default items-center justify-between overflow-hidden rounded border border-[#302517] bg-gradient-to-b from-[#0a0a09] to-[#0c0c0b] px-4 py-1.5 transition-all duration-500 select-none hover:shadow-[0_0_20px_rgba(217,158,34,0.1),inset_0_1px_1px_rgba(255,228,180,0.03)]"
    >
      {/* Dynamic scanlines simulating VFD panel glass */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(18,15,11,0.15)_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] opacity-35" />

      {/* Hover ambient radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,158,34,0.06),transparent_60%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />

      {/* Date block with vertical separator */}
      <div className="z-10 flex h-full items-center gap-1.5 border-r border-[#20180f] pr-3">
        <span className="text-silver-400 font-sans text-[8.5px] font-semibold tracking-[0.18em]">
          {weekday}
        </span>
        <span className="text-brass-500/40 text-[7px] font-bold select-none">•</span>
        <span className="text-silver-200 font-sans text-[8.5px] font-semibold tracking-[0.18em]">
          {day} {month}
        </span>
      </div>

      {/* Time & Segment Display */}
      <div className="relative z-10 flex h-full items-center justify-center pr-2.5 pl-3.5 font-mono">
        {/* VFD Ghost/Unlit Segments (for hardware realism) */}
        <span className="text-carbon-900/25 quant-tabular-nums pointer-events-none absolute left-3.5 text-xs font-semibold tracking-[0.15em] select-none">
          88<span className="mx-0.5 font-normal">:</span>88
          <span className="ml-0.5 text-[10px] font-medium">:88</span>
        </span>

        {/* VFD Lit Segments (actual time with custom neon glow) */}
        <span className="text-brass-400 quant-tabular-nums group-hover:text-brass-300 relative text-xs font-semibold tracking-[0.15em] transition-all duration-300 [text-shadow:0_0_8px_rgba(240,180,41,0.25),0_0_20px_rgba(240,180,41,0.1)] group-hover:[text-shadow:0_0_12px_rgba(240,180,41,0.45),0_0_24px_rgba(240,180,41,0.2)]">
          {hours}
          <span className="text-brass-500/80 mx-0.5 animate-[pulse_1.5s_infinite] font-normal">
            :
          </span>
          {minutes}
          <span className="text-brass-500/75 ml-0.5 text-[10px] font-medium">:{seconds}</span>
        </span>
      </div>

      {/* Timezone Badge */}
      <div className="z-10 flex items-center pl-1">
        <span className="text-brass-600/40 group-hover:text-brass-500/70 group-hover:border-brass-600/35 rounded-sm border border-[#2b2115] bg-[#17130e] px-1 py-0.5 font-mono text-[7.5px] font-bold tracking-wider uppercase transition-colors duration-300">
          {getTimezone()}
        </span>
      </div>
    </div>
  )
}
