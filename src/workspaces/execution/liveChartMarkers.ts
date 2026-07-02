import type { ChartMarker, ChartMarkerKind } from '@/components/charts/types/chart'
import { timeframeToMs } from '@/lib/market/timeframes'
import type { Decision, Fill } from '@/types/execution'

type BarLike = { timestamp: string }

/** Signal actions that produce a marker; `hold` (and anything else) is skipped. */
const DECISION_KIND: Record<string, ChartMarkerKind> = {
  buy: 'buy',
  sell: 'sell',
  close: 'close',
}

function barIndexByMs(bars: BarLike[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const bar of bars) {
    const ms = Date.parse(bar.timestamp)
    if (!Number.isNaN(ms)) map.set(ms, bar.timestamp)
  }
  return map
}

/**
 * Resolve the chart bar a decision evaluated. Backends label a decision by the
 * bar's *close* time; the chart keys bars by their *open* time. We match the close
 * time directly (some conventions coincide) and fall back to `close − timeframe`.
 */
function decisionBarTimestamp(
  closeMs: number,
  tfMs: number,
  byMs: Map<number, string>,
): string | null {
  return byMs.get(closeMs) ?? byMs.get(closeMs - tfMs) ?? null
}

/** Locate the bar whose window contains a fill timestamp (greatest open ≤ fill). */
function fillBarTimestamp(fillMs: number, sortedOpens: number[], byMs: Map<number, string>) {
  let match: number | null = null
  for (const open of sortedOpens) {
    if (open <= fillMs) match = open
    else break
  }
  return match == null ? null : (byMs.get(match) ?? null)
}

export type BuildChartMarkersArgs = {
  decisions: Decision[]
  fills: Fill[]
  bars: BarLike[]
  timeframe: string
}

/**
 * Map persisted decisions/fills onto chart bar timestamps. `hold` decisions and
 * events outside the chart window are dropped. Never invents optimistic markers —
 * callers pass only persisted rows.
 */
export function buildChartMarkers({
  decisions,
  fills,
  bars,
  timeframe,
}: BuildChartMarkersArgs): ChartMarker[] {
  if (bars.length === 0) return []
  const byMs = barIndexByMs(bars)
  const sortedOpens = [...byMs.keys()].sort((a, b) => a - b)
  const tfMs = timeframeToMs(timeframe)
  const markers: ChartMarker[] = []

  for (const decision of decisions) {
    const kind = DECISION_KIND[decision.signal_action]
    if (!kind) continue
    const closeMs = Date.parse(decision.bar_close_time)
    if (Number.isNaN(closeMs)) continue
    const timestamp = decisionBarTimestamp(closeMs, tfMs, byMs)
    if (!timestamp) continue
    const qty = decision.requested_quantity
    const detail = [
      `${decision.signal_action.toUpperCase()} decision`,
      decision.reason ? `reason: ${decision.reason}` : null,
      qty != null ? `qty: ${qty}` : null,
      `bar close: ${decision.bar_close_time}`,
    ]
      .filter(Boolean)
      .join('\n')
    markers.push({
      id: `decision-${decision.id}`,
      timestamp,
      kind,
      label: decision.signal_action.toUpperCase(),
      detail,
    })
  }

  for (const fill of fills) {
    const fillMs = Date.parse(fill.filled_at)
    if (Number.isNaN(fillMs)) continue
    const timestamp = fillBarTimestamp(fillMs, sortedOpens, byMs)
    if (!timestamp) continue
    const price = Number.parseFloat(fill.price)
    const detail = [
      `FILL ${fill.side}`,
      `qty: ${fill.quantity}`,
      `price: ${fill.price}`,
      `at: ${fill.filled_at}`,
    ].join('\n')
    markers.push({
      id: `fill-${fill.id}`,
      timestamp,
      kind: 'fill',
      label: `FILL ${fill.side}`,
      detail,
      price: Number.isNaN(price) ? null : price,
    })
  }

  return markers
}
