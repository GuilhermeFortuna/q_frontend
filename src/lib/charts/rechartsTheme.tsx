import type { ComponentProps } from 'react'
import type { TooltipProps } from 'recharts'
import { CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltip, type ChartTooltipRow } from '@/components/charts/ChartTooltip'
import { chartTheme } from '@/lib/charts/chartTheme'

export const chartMargin = chartTheme.margin

export const themedGridProps = {
  stroke: chartTheme.grid.stroke,
  strokeDasharray: chartTheme.grid.dash,
} as const

export const themedXAxisProps = {
  tick: chartTheme.axis.tick,
  tickLine: chartTheme.axis.tickLine,
  axisLine: chartTheme.axis.axisLine,
} as const

export const themedYAxisProps = themedXAxisProps

export const themedTooltipCursor = {
  stroke: chartTheme.crosshair.stroke,
  strokeDasharray: chartTheme.crosshair.strokeDasharray,
} as const

export type ThemedTooltipProps = Omit<
  TooltipProps<number, string>,
  'content' | 'contentStyle' | 'labelStyle' | 'itemStyle' | 'cursor'
> & {
  formatter?: (
    value: number,
    name: string,
    item: { payload?: Record<string, unknown>; color?: string },
  ) => ChartTooltipRow | [string | number, string] | null
  labelFormatter?: (label: string) => string
}

export function ThemedTooltip({ formatter, labelFormatter, ...rest }: ThemedTooltipProps) {
  return (
    <Tooltip
      {...rest}
      cursor={themedTooltipCursor}
      content={<ChartTooltip formatter={formatter as never} labelFormatter={labelFormatter} />}
    />
  )
}

export function ThemedCartesianGrid(props: ComponentProps<typeof CartesianGrid>) {
  return <CartesianGrid {...themedGridProps} {...props} />
}

export function ThemedXAxis(props: ComponentProps<typeof XAxis>) {
  return <XAxis {...themedXAxisProps} {...props} />
}

export function ThemedYAxis(props: ComponentProps<typeof YAxis>) {
  return <YAxis {...themedYAxisProps} {...props} />
}

export function scatterTooltipFormatter(xLabel: string, yLabel: string, trialKey: 'n' = 'n') {
  return (value: number, name: string, item: { payload?: Record<string, unknown> }) => {
    const trialNumber = item.payload?.[trialKey]
    const label = name === 'x' ? xLabel : name === 'y' ? yLabel : name
    return [value.toFixed(4), trialNumber != null ? `Trial #${trialNumber} · ${label}` : label] as [
      string,
      string,
    ]
  }
}
