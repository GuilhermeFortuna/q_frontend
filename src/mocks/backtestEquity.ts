import type { BacktestEquityArtifactPoint } from '@/types/backtesting'

function buildMockEquityCurve(
  runId: string,
  initialCapital: number,
  totalReturnPct: number,
  points = 12,
): BacktestEquityArtifactPoint[] {
  const start = new Date('2024-01-01T00:00:00.000Z').getTime()
  const end = new Date('2024-06-01T00:00:00.000Z').getTime()
  const target = initialCapital * (1 + totalReturnPct)
  const curve: BacktestEquityArtifactPoint[] = []

  for (let index = 0; index < points; index += 1) {
    const progress = points <= 1 ? 1 : index / (points - 1)
    const wobble = Math.sin((index + runId.length) * 0.9) * initialCapital * 0.01 * (1 - progress)
    const equity = initialCapital + (target - initialCapital) * progress + wobble
    curve.push({
      time: new Date(start + (end - start) * progress).toISOString(),
      equity: Number(equity.toFixed(2)),
    })
  }

  return curve
}

const mockBacktestEquityArtifacts: Record<string, BacktestEquityArtifactPoint[]> = {
  'run-win-ma': buildMockEquityCurve('run-win-ma', 100_000, 0.124),
  'run-vale-ma': buildMockEquityCurve('run-vale-ma', 250_000, -0.024),
  'run-tick-ma': buildMockEquityCurve('run-tick-ma', 100_000, -0.018),
}

export function getMockBacktestEquityArtifact(runId: string) {
  const points = mockBacktestEquityArtifacts[runId]
  if (!points) return null
  return { run_id: runId, points }
}

export function buildMockEquityCurveForTest(
  initialCapital: number,
  totalReturnPct: number,
): BacktestEquityArtifactPoint[] {
  return buildMockEquityCurve('test-run', initialCapital, totalReturnPct, 4)
}
