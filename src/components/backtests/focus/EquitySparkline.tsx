import { closesToPath, sparklineStrokeColor } from '@/lib/market/sparkline'
import type { EquityPoint } from '@/types/backtesting'

type EquitySparklineProps = {
  data: EquityPoint[]
  width?: number
  height?: number
  className?: string
}

export function EquitySparkline({
  data,
  width = 88,
  height = 28,
  className,
}: EquitySparklineProps) {
  const closes = data.map((point) => point.equity)
  const path = closesToPath(closes, width, height)
  const stroke = sparklineStrokeColor(closes)

  if (!path) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        aria-hidden
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--color-carbon-600)"
          strokeWidth={1}
        />
      </svg>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}
