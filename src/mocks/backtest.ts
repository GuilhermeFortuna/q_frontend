import type { OhlcvBar } from '@/types/api'
import { getMockMlFilterBacktestSummary } from '@/mocks/mlFilters'
import { timeframeToMs } from '@/lib/market/timeframes'
import type {
  BacktestRequest,
  BacktestResponse,
  ChartIndicatorSeries,
  BacktestPerformance,
  Trade,
} from '@/types/backtesting'

function buildMockPerformance(trades: Trade[]): BacktestPerformance {
  const ordered = [...trades]
    .filter((trade) => trade.exit_time)
    .sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime())
  const timeAt = (index: number) =>
    ordered[Math.min(index, ordered.length - 1)]?.exit_time ?? new Date().toISOString()
  const tradeStats = {
    total: 48,
    winning: 28,
    losing: 20,
    breakeven: 1,
    win_rate: 28 / 48,
    profit_factor: 1.42,
    expectancy: 51.75,
    avg_win: 153.2,
    avg_loss: -90.28,
    payoff_ratio: 1.7,
    largest_win: 430,
    largest_loss: -285,
    max_consecutive_wins: 6,
    max_consecutive_losses: 3,
    avg_hold_seconds: 14400,
    avg_win_hold_seconds: 16200,
    avg_loss_hold_seconds: 11700,
    excursion_trades: 48,
    avg_mfe: 180,
    avg_mae: 95,
    mfe_capture: 0.62,
    median_mfe_capture: 0.58,
    median_time_to_mfe_seconds: 5400,
    avg_post_exit_return: 12.5,
    post_exit_continuation_rate: 0.42,
  }

  return {
    basis: { equity: 'closed_trade', periods_per_year: 252, risk_free_rate: 0 },
    portfolio: {
      net_pnl: 2484,
      gross_profit: 4290,
      gross_loss: -1806,
      total_commission: 288,
      return_pct: 0.02484,
      cagr_pct: 0.0512,
      max_drawdown_value: 612,
      max_drawdown_pct: 0.0061,
      max_drawdown_duration_days: 12,
      avg_drawdown_pct: 0.0024,
      recovery_factor: 4.06,
      calmar_ratio: 8.39,
      sharpe_ratio: 1.23,
      sortino_ratio: 1.87,
      annual_volatility_pct: 0.041,
      time_in_market_pct: 0.32,
      trades_per_month: 8,
    },
    trades: {
      all: tradeStats,
      long: {
        ...tradeStats,
        total: 24,
        winning: 15,
        losing: 9,
        win_rate: 15 / 24,
        profit_factor: 1.5,
        expectancy: 63.25,
        avg_win: 168.4,
        avg_loss: -112.25,
      },
      short: {
        ...tradeStats,
        total: 24,
        winning: 13,
        losing: 11,
        breakeven: 1,
        win_rate: 13 / 24,
        profit_factor: 1.34,
        expectancy: 40.25,
        avg_win: 135.6,
        avg_loss: -72.3,
      },
    },
    drawdowns: [
      {
        peak_time: timeAt(6),
        trough_time: timeAt(8),
        recovery_time: timeAt(10),
        depth_value: 612,
        depth_pct: 0.0061,
        duration_days: 4,
        trades: 3,
      },
      {
        peak_time: timeAt(14),
        trough_time: timeAt(16),
        recovery_time: timeAt(20),
        depth_value: 480,
        depth_pct: 0.0048,
        duration_days: 7,
        trades: 4,
      },
      {
        peak_time: timeAt(28),
        trough_time: timeAt(30),
        recovery_time: timeAt(32),
        depth_value: 360,
        depth_pct: 0.0036,
        duration_days: 4,
        trades: 2,
      },
      {
        peak_time: timeAt(40),
        trough_time: timeAt(47),
        recovery_time: null,
        depth_value: 210,
        depth_pct: 0.0021,
        duration_days: 10,
        trades: 5,
      },
    ],
    exit_reasons: [
      { reason: 'SIGNAL', pnl: 2840, trades: 18, win_rate: 0.61 },
      { reason: 'TAKE_PROFIT', pnl: 3100, trades: 14, win_rate: 1.0 },
      { reason: 'TRAILING_STOP', pnl: 650, trades: 6, win_rate: 0.67 },
      { reason: 'STOP_LOSS', pnl: -1420, trades: 12, win_rate: 0.0 },
    ],
    entry_reasons: [
      { reason: 'VWAP reclaim', pnl: 2310, trades: 16, win_rate: 0.625 },
      { reason: 'Breakout', pnl: 1180, trades: 9, win_rate: 0.56 },
      { reason: 'unspecified', pnl: 520, trades: 7, win_rate: 0.43 },
    ],
    excursions: {
      post_exit_bars: 10,
      resolution: { tick: 42, minute: 4, candle: 2 },
    },
  }
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const MOCK_ENTRY_REASONS: (string | null)[] = ['VWAP reclaim', 'Breakout', null]

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
      entry_reason: MOCK_ENTRY_REASONS[i % MOCK_ENTRY_REASONS.length],
      exit_time: exitTime,
      exit_price: Number(exitPrice.toFixed(2)),
      status: 'CLOSED',
      pnl: Number(pnl.toFixed(2)),
      commission: 0,
      point_value: 1,
      mfe_points: Number((Math.max(10, Math.abs(pnl) * 1.25)).toFixed(2)),
      mae_points: Number((Math.max(5, Math.abs(pnl) * 0.55)).toFixed(2)),
      mfe_time: new Date(new Date(entryTime).getTime() + (i % 4) * 60 * 60 * 1000).toISOString(),
      mfe_capture: Number((pnl / Math.max(10, Math.abs(pnl) * 1.25)).toFixed(3)),
      post_exit_return_points: Number(((seededRandom(i * 17) - 0.5) * 80).toFixed(2)),
      post_exit_bars_observed: 10,
      excursion_resolution: i % 11 === 0 ? 'candle' : i % 7 === 0 ? 'minute' : 'tick',
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
      line_style: 'dashed',
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

function generateMockTickChartData(
  request: BacktestRequest,
  trades: Trade[],
): { bars: OhlcvBar[]; indicators: ChartIndicatorSeries[]; trades: Trade[] } {
  const shortPeriod = Number(request.strategy_params?.short_period ?? 50)
  const longPeriod = Number(request.strategy_params?.long_period ?? 200)
  const displayTimeframe = request.display_timeframe ?? 'M1'
  const barCount = 240
  const now = Date.now()
  const barMs = timeframeToMs(displayTimeframe)

  const closes: number[] = []
  const bars: OhlcvBar[] = []

  for (let i = 0; i < barCount; i += 1) {
    const close = 128400 + seededRandom(i * 11) * 200 + i * 0.5
    closes.push(close)
    const open = close - 2
    bars.push({
      timestamp: new Date(now - (barCount - i) * barMs).toISOString(),
      open: Number(open.toFixed(1)),
      high: Number((close + 5).toFixed(1)),
      low: Number((open - 5).toFixed(1)),
      close: Number(close.toFixed(1)),
      volume: 500 + i * 5,
    })
  }

  const maShort = sma(closes, Math.min(shortPeriod, barCount))
  const maLong = sma(closes, Math.min(longPeriod, barCount))
  const delta = maShort.map((short, i) => {
    const long = maLong[i]
    if (short === null || long === null) return null
    return short - long
  })

  const indicators: ChartIndicatorSeries[] = [
    {
      key: 'ma_short',
      label: `SMA Short (${shortPeriod} ticks)`,
      pane: 'price',
      color: '#c9a227',
      line_style: 'dashed',
      values: maShort,
    },
    {
      key: 'ma_long',
      label: `SMA Long (${longPeriod} ticks)`,
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

  // Align timestamps to bars for chart markers; preserve exact tick prices.
  const alignedTrades = trades.map((trade, i) => {
    const entryBar = bars[Math.min(barCount - 1, 10 + i * 2)]
    const exitBar = bars[Math.min(barCount - 1, 12 + i * 2)]
    return {
      ...trade,
      entry_time: entryBar.timestamp,
      exit_time: exitBar.timestamp,
    }
  })

  return { bars, indicators, trades: alignedTrades }
}

export function getMockBacktestResponse(request: BacktestRequest): BacktestResponse {
  const symbol = request.symbol || 'PETR4'
  const initialCapital = request.initial_capital ?? 100000
  const rawTrades = generateMockTrades(symbol, 48)
  const chartData =
    request.engine === 'tick'
      ? generateMockTickChartData(request, rawTrades)
      : generateMockChartData(request, rawTrades)

  return {
    metrics: computeMetrics(chartData.trades, initialCapital),
    trades: chartData.trades,
    bars: chartData.bars,
    indicators: chartData.indicators,
    performance: buildMockPerformance(chartData.trades),
    run_id: request.engine === 'tick' ? 'mock-tick-run-id' : 'mock-persisted-run-id',
    ...(request.ml_filter ? { ml_filter_summary: getMockMlFilterBacktestSummary(request) } : {}),
  }
}

function csvLine(values: (string | number | null | undefined)[]): string {
  return values.map((value) => value ?? '').join(',')
}

/** Mirrors `GET /api/v1/backtests/{run_id}/export/market-data`. */
export function getMockBacktestMarketDataCsv(result: BacktestResponse): string {
  const header = ['time', 'open', 'high', 'low', 'close', 'volume']
  const lines = [csvLine([...header, ...result.indicators.map((indicator) => indicator.key)])]
  result.bars.forEach((bar, index) => {
    lines.push(
      csvLine([
        bar.timestamp,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        ...result.indicators.map((indicator) => indicator.values[index]),
      ]),
    )
  })
  return `${lines.join('\n')}\n`
}

/** Mirrors `GET /api/v1/backtests/{run_id}/export/trades`. */
export function getMockBacktestTradesCsv(result: BacktestResponse): string {
  const lines = [
    'trade_id,symbol,side,entry_time,entry_price,exit_time,exit_price,pnl,quantity,commission,point_value,entry_reason,exit_reason',
  ]
  for (const trade of result.trades) {
    lines.push(
      csvLine([
        trade.id,
        trade.symbol,
        trade.action,
        trade.entry_time,
        trade.entry_price,
        trade.exit_time,
        trade.exit_price,
        trade.pnl,
        trade.quantity,
        trade.commission,
        trade.point_value,
        trade.entry_reason,
        trade.exit_reason,
      ]),
    )
  }
  return `${lines.join('\n')}\n`
}
