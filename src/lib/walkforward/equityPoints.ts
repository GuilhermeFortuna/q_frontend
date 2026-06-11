import type { EquityPoint } from '@/types/backtesting'
import type { WalkForwardEquityPoint } from '@/types/walkforward'

export function walkForwardEquityToChartPoints(points: WalkForwardEquityPoint[]): EquityPoint[] {
  if (points.length === 0) {
    return []
  }

  const initial = points[0]?.equity ?? 0
  let peak = initial

  return points.map((point) => {
    peak = Math.max(peak, point.equity)
    const drawdown = peak - point.equity
    const drawdownPct = peak > 0 ? drawdown / peak : 0
    return {
      timestamp: point.time,
      equity: point.equity,
      pnl: point.equity - initial,
      drawdown,
      drawdownPct,
    }
  })
}
