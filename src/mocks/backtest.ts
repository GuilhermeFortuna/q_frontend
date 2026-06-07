import type { BacktestRequest, BacktestResponse, Trade } from '@/types/backtesting'

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

export function getMockBacktestResponse(request: BacktestRequest): BacktestResponse {
  const symbol = request.symbol || 'PETR4'
  const initialCapital = request.initial_capital ?? 100000
  const trades = generateMockTrades(symbol, 48)

  return {
    metrics: computeMetrics(trades, initialCapital),
    trades,
  }
}
