import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { area, line, scaleLinear } from 'd3'
import { Activity, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/useDebounce'
import {
  fetchMarketIndicatorSeries,
  indicatorRequestErrorMessage,
  marketIndicatorKeys,
  seriesByInstance,
} from '@/api/queries/marketIndicators'
import {
  buildIndicatorRenderModel,
  type IndicatorRenderModel,
} from '@/lib/market/buildIndicatorRenderModel'
import { indicatorInstanceKey, type IndicatorConfig } from '@/lib/market/indicatorConfig'
import { indicatorDocumentation } from '@/lib/market/indicatorDocumentation'
import { barRangeForSeries } from '@/lib/market/indicatorSeriesAlign'
import { formatTimeAxisLabel, toApiTimeframe } from '@/lib/market/timeframes'
import type { IndicatorCatalogEntry } from '../../../contracts/api'
import type { OhlcvBar } from '@/types/api'

export type IndicatorPreviewContext = { symbol: string; timeframe: string; bars: OhlcvBar[] }
type Props = {
  entry: IndicatorCatalogEntry
  config: IndicatorConfig
  context?: IndicatorPreviewContext
  invalid?: boolean
}
type Output = { key: string; label: string; values: (number | null)[]; color: string }
const OUTPUT_COLORS = ['#c9a227', '#6eb5ff', '#a78bfa', '#26a69a']
const EMPTY_BARS: OhlcvBar[] = []
const formatValue = (value: number | null | undefined) =>
  value != null && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(value)
    : '—'

/** A single exact-context query: no previous selection is presented as fresh data. */
export function IndicatorPreview({ entry, config, context, invalid = false }: Props) {
  const identity = JSON.stringify([entry.id, config.parameters])
  const debouncedIdentity = useDebounce(identity, 300)
  const settling = identity !== debouncedIdentity
  const bars = context?.bars ?? EMPTY_BARS
  const range = barRangeForSeries(bars)
  const previewConfig = useMemo(() => ({ ...config, enabled: true }), [config])
  const query = useQuery({
    queryKey: marketIndicatorKeys.series(
      context?.symbol ?? '',
      context?.timeframe ?? '',
      range?.start ?? '',
      range?.end ?? '',
      indicatorInstanceKey(previewConfig),
    ),
    queryFn: async ({ signal }) => {
      const response = await fetchMarketIndicatorSeries(
        context!.symbol,
        {
          timeframe: toApiTimeframe(context!.timeframe),
          start: range!.start,
          end: range!.end,
          indicators: [{ id: entry.id, parameters: config.parameters }],
        },
        signal,
      )
      return seriesByInstance(response, [
        { instanceKey: indicatorInstanceKey(previewConfig), config: previewConfig, entry },
      ])
    },
    enabled: !!context?.symbol && !!range && !invalid && !settling,
    staleTime: 30_000,
    retry: false,
  })
  const model = useMemo(
    () => buildIndicatorRenderModel(bars, [previewConfig], [entry], query.data),
    [bars, previewConfig, entry, query.data],
  )
  const outputs = query.data?.byInstance[indicatorInstanceKey(previewConfig)] ?? []
  const unavailable = outputs.find((output) => output.unavailableReason)?.unavailableReason
  const plottedValues = [
    ...model.priceLines.map((output) => output.values),
    ...model.priceBands.flatMap((band) => [
      band.upper,
      band.lower,
      ...(band.middle ? [band.middle] : []),
    ]),
    ...model.oscillators.flatMap((group) => group.outputs.map((output) => output.values)),
  ]
  const hasValues = plottedValues.some((values) =>
    values.slice(-160).some((value) => value != null && Number.isFinite(value)),
  )
  let message: string | null = null
  if (!context?.symbol || !range) message = 'Load chart data to see a preview.'
  else if (invalid) message = 'Correct the parameter settings to update the preview.'
  else if (settling || (query.isPending && !query.isError))
    message = settling ? 'Updating preview…' : 'Loading preview…'
  else if (query.isError) message = indicatorRequestErrorMessage(query.error)
  else if (unavailable) message = unavailable
  else if (!hasValues)
    message = 'No values in this range. Load more history or shorten the lookback.'

  return (
    <section
      aria-label="Indicator data preview"
      className="surface-well border-carbon-700/70 overflow-hidden rounded-xl border"
    >
      <div className="border-carbon-700/50 flex min-h-9 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-[10px]">
        <span className="text-silver-200 flex items-center gap-1.5 font-semibold tracking-wide uppercase">
          <Activity aria-hidden className="text-brass-400 h-3 w-3" />
          Data preview
        </span>
        <span className="text-silver-300 font-mono">
          {context?.symbol
            ? `${context.symbol} · ${context.timeframe} · latest ${Math.min(bars.length, 160)} bars`
            : 'Current chart'}
        </span>
      </div>
      {message ? (
        <div
          className="text-silver-300 flex h-[180px] flex-col items-center justify-center gap-3 px-6 text-center text-xs leading-relaxed"
          role={query.isError && !invalid ? 'alert' : 'status'}
        >
          {(settling || query.isFetching) && (
            <RefreshCw aria-hidden className="text-brass-400 h-5 w-5 motion-safe:animate-spin" />
          )}
          <p>{message}</p>
          {query.isError && !invalid && (
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              Retry preview
            </Button>
          )}
        </div>
      ) : (
        <PreviewPlot
          key={`${context!.symbol}-${context!.timeframe}-${identity}`}
          entry={entry}
          config={config}
          bars={bars}
          model={model}
          timeframe={context!.timeframe}
          updating={query.isFetching}
        />
      )}
    </section>
  )
}

function PreviewPlot({
  entry,
  config,
  bars,
  model,
  timeframe,
  updating,
}: {
  entry: IndicatorCatalogEntry
  config: IndicatorConfig
  bars: OhlcvBar[]
  model: IndicatorRenderModel
  timeframe: string
  updating: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(620)
  const [hover, setHover] = useState<number | null>(null)
  const clipId = useId().replaceAll(':', '')
  useEffect(() => {
    const node = hostRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([size]) => setWidth(Math.max(200, size.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const chart = useMemo(() => {
    const offset = Math.max(0, bars.length - 160)
    const visible = bars.slice(offset)
    const color = config.style?.color ?? OUTPUT_COLORS[0]
    const outputs: Output[] = []
    for (const group of model.priceLines)
      outputs.push({
        key: group.outputKey,
        label: group.label,
        values: group.values.slice(offset),
        color: config.style?.outputColors?.[group.outputKey] ?? color,
      })
    for (const group of model.priceBands) {
      outputs.push({
        key: 'upper',
        label: 'Upper',
        values: group.upper.slice(offset),
        color: config.style?.outputColors?.upper ?? color,
      })
      if (group.middle)
        outputs.push({
          key: 'middle',
          label: 'Middle',
          values: group.middle.slice(offset),
          color: config.style?.outputColors?.middle ?? OUTPUT_COLORS[1],
        })
      outputs.push({
        key: 'lower',
        label: 'Lower',
        values: group.lower.slice(offset),
        color: config.style?.outputColors?.lower ?? color,
      })
    }
    for (const group of model.oscillators)
      group.outputs.forEach((output, index) =>
        outputs.push({
          key: output.outputKey,
          label: output.label,
          values: output.values.slice(offset),
          color:
            config.style?.outputColors?.[output.outputKey] ??
            (index === 0 ? color : OUTPUT_COLORS[index % OUTPUT_COLORS.length]),
        }),
      )
    const oscillator = model.oscillators.length > 0
    const reference = indicatorDocumentation[entry.id]?.referenceLines ?? []
    const left = 10
    const right = width - 58
    const x = scaleLinear()
      .domain([-0.5, visible.length - 0.5])
      .range([left, right])
    const priceValues = visible.flatMap((bar) => [bar.low, bar.high]).filter(Number.isFinite)
    const outputValues = outputs
      .flatMap((output) => output.values)
      .filter((v): v is number => v != null && Number.isFinite(v))
    const domain = (values: number[]) => {
      const min = Math.min(...values)
      const max = Math.max(...values)
      const pad = Math.max((max - min) * 0.08, Math.abs(max) * 0.002, 0.00001)
      return [min - pad, max + pad]
    }
    const priceY = scaleLinear()
      .domain(domain(oscillator ? priceValues : [...priceValues, ...outputValues]))
      .range(oscillator ? [52, 8] : [130, 8])
    const y = oscillator
      ? scaleLinear()
          .domain(
            entry.id === 'rsi'
              ? [0, 100]
              : entry.id === 'rolling_rank'
                ? [0, 1]
                : domain([...outputValues, ...reference]),
          )
          .range([130, 70])
      : priceY
    const lineFor = (values: (number | null)[]) =>
      line<number | null>()
        .defined((value) => value != null && Number.isFinite(value))
        .x((_, index) => x(index))
        .y((value) => y(value!))(values) ?? ''
    let bandPath = ''
    const band = model.priceBands[0]
    if (band) {
      const upper = band.upper.slice(offset)
      const lower = band.lower.slice(offset)
      bandPath =
        area<number>()
          .defined(
            (index) =>
              upper[index] != null &&
              lower[index] != null &&
              Number.isFinite(upper[index]) &&
              Number.isFinite(lower[index]),
          )
          .x((index) => x(index))
          .y0((index) => y(lower[index]!))
          .y1((index) => y(upper[index]!))(visible.map((_, index) => index)) ?? ''
    }
    return { visible, outputs, x, y, priceY, left, right, reference, oscillator, lineFor, bandPath }
  }, [bars, model, entry.id, config.style, width])

  const index = hover ?? chart.visible.length - 1
  const activeBar = chart.visible[index]
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    setHover(
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? chart.visible.length - 1
          : Math.max(
              0,
              Math.min(chart.visible.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)),
            ),
    )
  }
  return (
    <div ref={hostRef} className="relative h-[180px] px-2 pt-2">
      <svg
        role="img"
        tabIndex={0}
        aria-label={`${entry.label} preview. Use left and right arrows to inspect bars.`}
        aria-describedby={`${clipId}-description`}
        viewBox={`0 0 ${width} 150`}
        width="100%"
        height="150"
        onKeyDown={onKeyDown}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = ((event.clientX - rect.left) * width) / rect.width
          setHover(Math.max(0, Math.min(chart.visible.length - 1, Math.round(chart.x.invert(x)))))
        }}
        onPointerLeave={() => setHover(null)}
      >
        <title>{entry.label} on the current chart’s data</title>
        <defs>
          <clipPath id={clipId}>
            <rect x={chart.left} y={0} width={chart.right - chart.left} height={132} />
          </clipPath>
        </defs>
        {chart.y.ticks(3).map((tick) => (
          <g key={tick}>
            <line
              x1={chart.left}
              x2={chart.right}
              y1={chart.y(tick)}
              y2={chart.y(tick)}
              stroke="var(--color-carbon-700)"
              strokeOpacity={0.6}
            />
            <text
              x={chart.right + 7}
              y={chart.y(tick) + 3}
              fill="var(--color-silver-300)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {formatValue(tick)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {chart.visible.map((bar, i) => {
            const y = chart.priceY
            const candleWidth = Math.max(
              1,
              ((chart.right - chart.left) / chart.visible.length) * 0.55,
            )
            const color = bar.close >= bar.open ? '#26a69a' : '#ef5350'
            return (
              <g key={bar.timestamp} opacity={chart.oscillator ? 0.5 : 0.45}>
                <line
                  x1={chart.x(i)}
                  x2={chart.x(i)}
                  y1={y(bar.high)}
                  y2={y(bar.low)}
                  stroke={color}
                />
                <rect
                  x={chart.x(i) - candleWidth / 2}
                  y={Math.min(y(bar.open), y(bar.close))}
                  width={candleWidth}
                  height={Math.max(1, Math.abs(y(bar.open) - y(bar.close)))}
                  fill={color}
                />
              </g>
            )
          })}
          {chart.oscillator && (
            <line
              x1={chart.left}
              x2={chart.right}
              y1={60}
              y2={60}
              stroke="var(--color-carbon-700)"
            />
          )}
          {chart.reference.map((value) => (
            <line
              key={value}
              x1={chart.left}
              x2={chart.right}
              y1={chart.y(value)}
              y2={chart.y(value)}
              stroke="var(--color-silver-300)"
              strokeOpacity={0.35}
              strokeDasharray="3 4"
            />
          ))}
          {chart.bandPath && (
            <path
              d={chart.bandPath}
              fill={config.style?.color ?? OUTPUT_COLORS[0]}
              fillOpacity={0.1}
            />
          )}
          {chart.outputs.map((output) =>
            output.key === 'histogram' ? (
              <g key={output.key}>
                {output.values.map((value, i) =>
                  value != null && Number.isFinite(value) ? (
                    <rect
                      key={i}
                      x={chart.x(i) - 1}
                      y={Math.min(chart.y(0), chart.y(value))}
                      width={Math.max(
                        1,
                        ((chart.right - chart.left) / chart.visible.length) * 0.65,
                      )}
                      height={Math.max(1, Math.abs(chart.y(0) - chart.y(value)))}
                      fill={value >= 0 ? '#26a69a' : '#ef5350'}
                      opacity={0.65}
                    />
                  ) : null,
                )}
              </g>
            ) : (
              <path
                key={output.key}
                data-testid={`preview-output-${output.key}`}
                d={chart.lineFor(output.values)}
                stroke={output.color}
                strokeWidth={1.5}
                strokeDasharray={output.key === 'signal' ? '4 3' : undefined}
                fill="none"
              />
            ),
          )}
          {hover !== null && (
            <line
              x1={chart.x(index)}
              x2={chart.x(index)}
              y1={0}
              y2={132}
              stroke="var(--color-silver-200)"
              strokeOpacity={0.4}
              strokeDasharray="2 3"
            />
          )}
        </g>
        <text
          x={chart.left}
          y={147}
          fill="var(--color-silver-300)"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          {formatTimeAxisLabel(chart.visible[0].timestamp, timeframe)}
        </text>
        <text
          x={chart.right}
          y={147}
          textAnchor="end"
          fill="var(--color-silver-300)"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          {formatTimeAxisLabel(chart.visible.at(-1)!.timestamp, timeframe)}
        </text>
      </svg>
      <div className="text-silver-200 absolute right-3 bottom-2 left-3 flex items-center gap-3 overflow-hidden text-[10px]">
        <span className="text-silver-300 shrink-0 font-mono">
          {hover !== null ? formatTimeAxisLabel(activeBar.timestamp, timeframe) : 'Latest'}
        </span>
        {chart.outputs.map((output) => (
          <span key={output.key} className="flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  output.key === 'histogram'
                    ? 'linear-gradient(90deg, #26a69a 50%, #ef5350 50%)'
                    : output.color,
              }}
            />
            {output.label} <span className="font-mono">{formatValue(output.values[index])}</span>
            {entry.unit ? ` ${entry.unit}` : ''}
          </span>
        ))}
        {updating && (
          <span role="status" className="text-silver-300">
            Updating…
          </span>
        )}
      </div>
      <p id={`${clipId}-description`} className="sr-only">
        {entry.pane === 'price'
          ? 'Indicator overlaid on price candles.'
          : 'Price candles above a separate indicator pane.'}{' '}
        {chart.outputs
          .map(
            (output) =>
              `${output.label}: ${formatValue(output.values.at(-1))}${entry.unit ? ` ${entry.unit}` : ''}.`,
          )
          .join(' ')}{' '}
        Gaps represent unavailable values.
      </p>
    </div>
  )
}
