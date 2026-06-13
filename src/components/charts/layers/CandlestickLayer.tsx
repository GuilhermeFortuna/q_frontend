import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { ChartType, ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'

type CandlestickLayerProps = {
  bars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  chartType: ChartType
  left: number
  hoveredTimestamp?: string | null
}

export function CandlestickLayer({
  bars,
  xScale,
  yScale,
  chartType,
  left,
  hoveredTimestamp,
}: CandlestickLayerProps) {
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
            fill="url(#area-gradient)"
            stroke="none"
          />
        )}
        <polyline fill="none" stroke={BRASS_COLOR} strokeWidth={1.5} points={points} />
      </g>
    )
  }

  const isNarrow = bandwidth < 4

  return (
    <g transform={`translate(${left}, 0)`}>
      {bars.map((bar) => {
        const x = xScale(bar.timestamp) ?? 0
        const cx = Math.round(x + bandwidth / 2)
        const isHovered = bar.timestamp === hoveredTimestamp

        const wickTop = Math.round(yScale(bar.high))
        const wickBottom = Math.round(yScale(bar.low))

        return (
          <g key={bar.timestamp}>
            {isHovered && (
              <rect
                x={Math.floor(x)}
                y={yScale.range()[1]}
                width={Math.max(Math.ceil(bandwidth), 1)}
                height={Math.max(yScale.range()[0] - yScale.range()[1], 0)}
                fill="rgba(255, 255, 255, 0.05)"
                pointerEvents="none"
                shapeRendering="crispEdges"
              />
            )}

            {isNarrow ? (
              <line
                x1={cx}
                x2={cx}
                y1={wickTop}
                y2={wickBottom}
                stroke={bar.color}
                strokeWidth={Math.max(Math.floor(bandwidth), 1)}
                shapeRendering="crispEdges"
              />
            ) : (
              <>
                <line
                  x1={cx}
                  x2={cx}
                  y1={wickTop}
                  y2={wickBottom}
                  stroke={bar.color}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <rect
                  x={Math.floor(cx - Math.max(Math.round(bandwidth * 0.7), 1) / 2)}
                  y={Math.round(yScale(Math.max(bar.open, bar.close)))}
                  width={Math.max(Math.round(bandwidth * 0.7), 1)}
                  height={Math.max(
                    Math.round(yScale(Math.min(bar.open, bar.close))) -
                      Math.round(yScale(Math.max(bar.open, bar.close))),
                    1,
                  )}
                  fill={bar.isBullish ? 'url(#bull-gradient)' : 'url(#bear-gradient)'}
                  stroke={bar.color}
                  strokeWidth={1}
                  rx={1.5}
                  ry={1.5}
                  shapeRendering="geometricPrecision"
                />
              </>
            )}
          </g>
        )
      })}
    </g>
  )
}
