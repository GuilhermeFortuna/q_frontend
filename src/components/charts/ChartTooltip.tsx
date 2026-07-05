import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion/useReducedMotion'
import { chartTheme } from '@/lib/charts/chartTheme'

export type ChartTooltipRow = {
  name: string
  value: string
  color?: string
}

export type ChartTooltipProps = {
  active?: boolean
  label?: string
  payload?: Array<{
    name?: string
    value?: number | string
    color?: string
    dataKey?: string | number
  }>
  /** visx / manual adapter shape */
  items?: ChartTooltipRow[]
  labelFormatter?: (label: string) => string
  formatter?: (
    value: number,
    name: string,
    item: { payload?: Record<string, unknown>; color?: string },
  ) => ChartTooltipRow | [string | number, string] | null
  className?: string
}

function normalizeRows(props: ChartTooltipProps): ChartTooltipRow[] {
  if (props.items?.length) return props.items
  if (!props.payload?.length) return []

  return props.payload.flatMap((entry, index) => {
    const rawValue = entry.value
    const rawName = String(entry.name ?? entry.dataKey ?? `Series ${index + 1}`)
    if (props.formatter && typeof rawValue === 'number') {
      const formatted = props.formatter(rawValue, rawName, {
        payload: entry as Record<string, unknown>,
        color: entry.color,
      })
      if (formatted == null) return []
      if (Array.isArray(formatted)) {
        return [{ name: String(formatted[1]), value: String(formatted[0]), color: entry.color }]
      }
      return [formatted]
    }
    return [
      {
        name: rawName,
        value: rawValue == null ? '—' : String(rawValue),
        color: entry.color,
      },
    ]
  })
}

export function ChartTooltip({
  active,
  label,
  labelFormatter,
  className,
  ...rest
}: ChartTooltipProps) {
  const reduced = useReducedMotion()
  const rows = normalizeRows(rest)
  if (!active || rows.length === 0) return null

  const displayLabel = label && labelFormatter ? labelFormatter(label) : label

  return (
    <div
      className={cn(
        chartTheme.tooltip.shellClass,
        !reduced && 'transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-out)]',
        className,
      )}
    >
      {displayLabel ? (
        <p className={cn(chartTheme.tooltip.labelClass, 'mb-1.5')}>{displayLabel}</p>
      ) : null}
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={`${row.name}-${row.value}`} className="flex items-center justify-between gap-4">
            <span className={cn('flex items-center gap-1.5', chartTheme.tooltip.nameClass)}>
              {row.color ? (
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
              ) : null}
              {row.name}
            </span>
            <span className={chartTheme.tooltip.valueClass}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Adapter for visx tooltip data shapes */
export function ChartTooltipFromItems({
  active,
  label,
  items,
  className,
}: {
  active?: boolean
  label?: string
  items: ChartTooltipRow[]
  className?: string
}) {
  return <ChartTooltip active={active} label={label} items={items} className={className} />
}
