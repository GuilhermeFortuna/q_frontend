import { memo, useMemo } from 'react'

import type { BandScale, LinearScale } from '@/components/charts/types/scales'

import type { ChartType, ProcessedBar } from '@/components/charts/types/chart'
import { BRASS_COLOR } from '@/components/charts/types/chart'

type CandlestickLayerProps = {
  bars: ProcessedBar[]
  xScale: BandScale
  yScale: LinearScale
  chartType: ChartType
  left: number
  candleOpacity?: number
}

function CandlestickLayerImpl({
  bars,
  xScale,
  yScale,
  chartType,
  left,
  candleOpacity = 0.85,
}: CandlestickLayerProps) {
  const bandwidth = xScale.bandwidth()

  const lineOrArea = useMemo(() => {
    if (chartType !== 'line' && chartType !== 'area') return null

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
  }, [bars, bandwidth, chartType, left, xScale, yScale])

  const candles = useMemo(() => {
    if (chartType === 'line' || chartType === 'area') return null

    const isNarrow = bandwidth < 4

    return (
      <g transform={`translate(${left}, 0)`}>
        {bars.map((bar) => {
          const x = xScale(bar.timestamp) ?? 0
          const cx = Math.round(x + bandwidth / 2)

          const wickTop = Math.round(yScale(bar.high))
          const wickBottom = Math.round(yScale(bar.low))

          return (
            <g key={bar.timestamp}>
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
                    fillOpacity={candleOpacity}
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
  }, [bars, bandwidth, candleOpacity, chartType, left, xScale, yScale])

  return lineOrArea ?? candles
}

export const CandlestickLayer = memo(CandlestickLayerImpl)
