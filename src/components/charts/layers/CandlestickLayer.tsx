import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { ChartType, ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'

type CandlestickLayerProps = {
  bars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  chartType: ChartType
  left: number
}

export function CandlestickLayer({ bars, xScale, yScale, chartType, left }: CandlestickLayerProps) {
  const bandwidth = xScale.bandwidth()

  if (chartType === 'line' || chartType === 'area') {
    const points = bars
      .map((bar) => {
        const x = (xScale(bar.timestamp) ?? 0) + bandwidth / 2
        const y = yScale(bar.close)
        return `${x},${y}`
      })
      .join(' ')

    return (
      <g transform={`translate(${left}, 0)`}>
        {chartType === 'area' && points && (
          <polygon
            points={`${points} ${(xScale(bars[bars.length - 1]?.timestamp) ?? 0) + bandwidth / 2},${yScale.range()[0]} ${(xScale(bars[0]?.timestamp) ?? 0) + bandwidth / 2},${yScale.range()[0]}`}
            fill="rgba(201, 162, 39, 0.12)"
            stroke="none"
          />
        )}
        <polyline fill="none" stroke={BRASS_COLOR} strokeWidth={1.5} points={points} />
      </g>
    )
  }

  return (
    <g transform={`translate(${left}, 0)`}>
      {bars.map((bar) => {
        const x = xScale(bar.timestamp) ?? 0
        const cx = x + bandwidth / 2
        const bodyTop = yScale(Math.max(bar.open, bar.close))
        const bodyBottom = yScale(Math.min(bar.open, bar.close))
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1)
        const wickTop = yScale(bar.high)
        const wickBottom = yScale(bar.low)

        return (
          <g key={bar.timestamp}>
            <line x1={cx} x2={cx} y1={wickTop} y2={wickBottom} stroke={bar.color} strokeWidth={1} />
            <rect
              x={x + bandwidth * 0.15}
              y={bodyTop}
              width={bandwidth * 0.7}
              height={bodyHeight}
              fill={bar.color}
            />
          </g>
        )
      })}
    </g>
  )
}
