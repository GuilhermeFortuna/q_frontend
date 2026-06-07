import type { OhlcvBar } from '@/types/api'
import type {
  BacktestRequest,
  BacktestResponse,
  ChartIndicatorSeries,
  Trade,
} from '@/types/backtesting'

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateMockTrades(symbol: string, count: number): Trade[] {
  const trades: Trade[] = []
  const now = Date.now()
  const sixMonthsMs = 180 * 24 * 60 * 60 * 1000

  for (let i = 0; i < count; i += 1) {
    const rand = seededRandom(i * 13 + symbol.charCodeAt(0))
    const pnl = (rand - 0.42) * 800
    const isBuy = i % 2 === 0
    const exitOffset = sixMonthsMs - (i / count) * sixMonthsMs
    const exitTime = new Date(now - exitOffset).toISOString()
    const entryTime = new Date(now - exitOffset - 3600000 * 4).toISOString()
    const entryPrice = 40 + seededRandom(i * 7) * 5
    const exitPrice = entryPrice + (isBuy ? pnl : -pnl)

    trades.push({
      id: `mock-trade-${i}`,
      order_id: `mock-order-${i}`,
      symbol,
      action: isBuy ? 'BUY' : 'SELL',
      quantity: 1,
      entry_time: entryTime,
      entry_price: Number(entryPrice.toFixed(2)),
      exit_time: exitTime,
      exit_price: Number(exitPrice.toFixed(2)),
      status: 'CLOSED',
      pnl: Number(pnl.toFixed(2)),
      commission: 0,
      point_value: 1,
    })
  }

  return trades.sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime())
}

function computeMetrics(trades: Trade[], initialCapital: number) {
  const closed = trades.filter((t) => t.pnl != null)
  const totalTrades = closed.length
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winning = closed.filter((t) => (t.pnl ?? 0) > 0)
  const losing = closed.filter((t) => (t.pnl ?? 0) <= 0)
  const grossProfit = winning.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const grossLoss = losing.reduce((sum, t) => sum + (t.pnl ?? 0), 0)

  let equity = initialCapital
  let peak = initialCapital
  let maxDdVal = 0
  let maxDdPct = 0

  for (const t of closed) {
    equity += t.pnl ?? 0
    if (equity > peak) peak = equity
    const ddVal = peak - equity
    const ddPct = peak > 0 ? ddVal / peak : 0
    maxDdVal = Math.max(maxDdVal, ddVal)
    maxDdPct = Math.max(maxDdPct, ddPct)
  }

  let winStreak = 0
  let lossStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0

  for (const t of closed) {
    if ((t.pnl ?? 0) > 0) {
      winStreak += 1
      lossStreak = 0
      maxWinStreak = Math.max(maxWinStreak, winStreak)
    } else {
      lossStreak += 1
      winStreak = 0
      maxLossStreak = Math.max(maxLossStreak, lossStreak)
    }
  }

  const avgWin = winning.length ? grossProfit / winning.length : 0
  const avgLoss = losing.length ? grossLoss / losing.length : 0

  return {
    total_trades: totalTrades,
    total_pnl: totalPnl,
    win_rate: totalTrades ? winning.length / totalTrades : 0,
    winning_trades: winning.length,
    losing_trades: losing.length,
    max_drawdown_value: maxDdVal,
    max_drawdown_pct: maxDdPct,
    profit_factor: grossLoss !== 0 ? grossProfit / Math.abs(grossLoss) : grossProfit,
    recovery_factor: maxDdVal > 0 ? totalPnl / maxDdVal : 0,
    expectancy: totalTrades ? totalPnl / totalTrades : 0,
    avg_win: avgWin,
    avg_loss: avgLoss,
    win_loss_ratio: avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0,
    max_consecutive_wins: maxWinStreak,
    max_consecutive_losses: maxLossStreak,
  }
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null
    const slice = values.slice(i - period + 1, i + 1)
    return slice.reduce((sum, v) => sum + v, 0) / period
  })
}

function generateMockChartData(
  request: BacktestRequest,
  trades: Trade[],
): { bars: OhlcvBar[]; indicators: ChartIndicatorSeries[]; trades: Trade[] } {
  const shortPeriod = Number(request.strategy_params?.short_period ?? 50)
  const longPeriod = Number(request.strategy_params?.long_period ?? 200)
  const barCount = 120
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  const closes: number[] = []
  const bars: OhlcvBar[] = []

  for (let i = 0; i < barCount; i += 1) {
    const close = 40 + seededRandom(i * 11) * 10 + i * 0.05
    closes.push(close)
    const open = close - 0.3
    bars.push({
      timestamp: new Date(now - (barCount - i) * dayMs).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number((close + 0.8).toFixed(2)),
      low: Number((open - 0.8).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 1000 + i * 10,
    })
  }

  const maShort = sma(closes, shortPeriod)
  const maLong = sma(closes, longPeriod)
  const delta = maShort.map((short, i) => {
    const long = maLong[i]
    if (short === null || long === null) return null
    return short - long
  })

  const indicators: ChartIndicatorSeries[] = [
    {
      key: 'ma_short',
      label: `MA Short (${shortPeriod})`,
      pane: 'price',
      color: '#c9a227',
      values: maShort,
    },
    {
      key: 'ma_long',
      label: `MA Long (${longPeriod})`,
      pane: 'price',
      color: '#6eb5ff',
      values: maLong,
    },
    {
      key: 'delta',
      label: 'Delta',
      pane: 'oscillator',
      color: '#c9a227',
      values: delta,
    },
  ]

  // Align mock trade timestamps to bar timestamps for chart markers
  const alignedTrades = trades.map((trade, i) => {
    const entryBar = bars[Math.min(barCount - 1, 10 + i * 2)]
    const exitBar = bars[Math.min(barCount - 1, 12 + i * 2)]
    return {
      ...trade,
      entry_time: entryBar.timestamp,
      entry_price: entryBar.close,
      exit_time: exitBar.timestamp,
      exit_price: exitBar.close,
    }
  })

  return { bars, indicators, trades: alignedTrades }
}

export function getMockBacktestResponse(request: BacktestRequest): BacktestResponse {
  const symbol = request.symbol || 'PETR4'
  const initialCapital = request.initial_capital ?? 100000
  const rawTrades = generateMockTrades(symbol, 48)
  const chartData = generateMockChartData(request, rawTrades)

  return {
    metrics: computeMetrics(chartData.trades, initialCapital),
    trades: chartData.trades,
    bars: chartData.bars,
    indicators: chartData.indicators,
  }
}
