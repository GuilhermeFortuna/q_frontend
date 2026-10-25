import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BacktestPerformanceSummary } from '@/components/backtests/BacktestPerformanceSummary'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { BacktestPerformance } from '@/types/backtesting'

const performance: BacktestPerformance = {
  basis: { equity: 'closed_trade', periods_per_year: 252, risk_free_rate: 0 },
  portfolio: {
    net_pnl: 350,
    gross_profit: 500,
    gross_loss: -150,
    total_commission: 12,
    return_pct: 0.035,
    cagr_pct: null,
    max_drawdown_value: 150,
    max_drawdown_pct: 0.0147,
    max_drawdown_duration_days: 16,
    avg_drawdown_pct: 0.0147,
    recovery_factor: 2.33,
    calmar_ratio: null,
    sharpe_ratio: null,
    sortino_ratio: 1.2,
    annual_volatility_pct: 0.08,
    time_in_market_pct: 0.4,
    trades_per_month: 4.06,
  },
  trades: {
    all: {
      total: 4,
      winning: 2,
      losing: 2,
      breakeven: 1,
      win_rate: 0.5,
      profit_factor: 2,
      expectancy: 87.5,
      avg_win: 250,
      avg_loss: -75,
      payoff_ratio: 3.33,
      largest_win: 300,
      largest_loss: -100,
      max_consecutive_wins: 2,
      max_consecutive_losses: 1,
      avg_hold_seconds: 100800,
      avg_win_hold_seconds: 10800,
      avg_loss_hold_seconds: 2700,
    },
    long: {
      total: 2,
      winning: 1,
      losing: 1,
      breakeven: 0,
      win_rate: 0.5,
      profit_factor: 1.5,
      expectancy: 50,
      avg_win: 150,
      avg_loss: -100,
      payoff_ratio: 1.5,
      largest_win: 150,
      largest_loss: -100,
      max_consecutive_wins: 1,
      max_consecutive_losses: 1,
      avg_hold_seconds: 16200,
      avg_win_hold_seconds: 18000,
      avg_loss_hold_seconds: 14400,
    },
    short: {
      total: 2,
      winning: 1,
      losing: 1,
      breakeven: 1,
      win_rate: 0.5,
      profit_factor: 3,
      expectancy: 125,
      avg_win: 300,
      avg_loss: -50,
      payoff_ratio: 6,
      largest_win: 300,
      largest_loss: -50,
      max_consecutive_wins: 1,
      max_consecutive_losses: 1,
      avg_hold_seconds: 3600,
      avg_win_hold_seconds: 3600,
      avg_loss_hold_seconds: 3600,
    },
  },
  drawdowns: [],
  exit_reasons: [],
  entry_reasons: [],
}

describe('BacktestPerformanceSummary', () => {
  const renderSummary = (value: BacktestPerformance) =>
    render(
      <TooltipProvider>
        <BacktestPerformanceSummary performance={value} />
      </TooltipProvider>,
    )

  it('renders grouped metrics, formats nullable values, and marks signed P&L', () => {
    renderSummary(performance)

    expect(screen.getByText('Returns')).toBeTruthy()
    expect(screen.getByText('Risk')).toBeTruthy()
    expect(screen.getByText('Trade quality')).toBeTruthy()
    expect(screen.getByText('Net P&L')).toBeTruthy()
    expect(screen.getByText('CAGR').parentElement?.parentElement?.textContent).toContain('—')
    expect(screen.getByText('Sharpe').parentElement?.parentElement?.textContent).toContain('—')
    expect(screen.getByText('Net P&L').parentElement?.parentElement?.textContent).toContain(
      '+350.00',
    )
    expect(screen.getByText('+350.00').className).toContain('text-emerald-400')
    expect(screen.getByText('W / L / BE').parentElement?.parentElement?.textContent).toContain(
      '2 / 2 / 1',
    )
    expect(screen.getByText('Average hold').parentElement?.parentElement?.textContent).toContain(
      '1d 4h',
    )
  })

  it('switches trade quality values between all, long, and short', () => {
    renderSummary(performance)

    fireEvent.click(screen.getByRole('radio', { name: 'Long' }))
    expect(screen.getByText('Trades').parentElement?.parentElement?.textContent).toContain('2')
    expect(screen.getByText('Expectancy').parentElement?.parentElement?.textContent).toContain(
      '50.00',
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Short' }))
    expect(screen.getByText('Expectancy').parentElement?.parentElement?.textContent).toContain(
      '125.00',
    )
  })

  it('shows infinity for a profitable group with no losing trades', () => {
    const allWinners = {
      ...performance,
      trades: {
        ...performance.trades,
        all: { ...performance.trades.all, losing: 0, winning: 4, profit_factor: null },
      },
    }
    renderSummary(allWinners)

    expect(screen.getByText('Profit factor').parentElement?.parentElement?.textContent).toContain(
      '∞',
    )
  })
})
