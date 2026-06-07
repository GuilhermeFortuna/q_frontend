import { invoke } from '@tauri-apps/api/core'

import { getMaTypeLabel } from '@/lib/backtesting/maTypes'
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/formatDate'
import type {
  BacktestRequest,
  BacktestResponse,
  EquityPoint,
  MonthlyStats,
} from '@/types/backtesting'

type KeyValue = { label: string; value: string }

/** Payload sent to the Rust `generate_backtest_report` command (camelCase). */
type BacktestReportPayload = {
  generatedAt: string
  config: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    initialCapital: number
    pointValue?: number
    strategy?: string
    strategyParams: KeyValue[]
    positionSizing: KeyValue[]
  }
  metrics: BacktestResponse['metrics']
  equityCurve: { equity: number; drawdownPct: number }[]
  monthlyStats: { label: string; pnl: number; trades: number; winRate: number }[]
  trades: {
    symbol: string
    action: string
    quantity: number
    entryTime: string
    entryPrice: number
    exitTime: string | null
    exitPrice: number | null
    pnl: number | null
  }[]
}

const PARAM_LABELS: Record<string, string> = {
  short_period: 'Short Period',
  long_period: 'Long Period',
  short_ma_type: 'Short MA Type',
  long_ma_type: 'Long MA Type',
  threshold: 'Threshold',
}

function humanizeKey(key: string): string {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatParamValue(key: string, value: unknown): string {
  if (key.endsWith('ma_type') && typeof value === 'string') {
    return getMaTypeLabel(value)
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toString()
  }
  return String(value)
}

function buildStrategyParams(params: Record<string, unknown> | undefined): KeyValue[] {
  if (!params) return []
  return Object.entries(params).map(([key, value]) => ({
    label: PARAM_LABELS[key] ?? humanizeKey(key),
    value: formatParamValue(key, value),
  }))
}

function buildPositionSizing(request: BacktestRequest | null): KeyValue[] {
  const ps = request?.position_sizing
  if (!ps) return []
  if (ps.type === 'fixed_quantity') {
    return [
      { label: 'Position Sizing', value: 'Fixed Quantity' },
      { label: 'Quantity', value: String(ps.quantity) },
    ]
  }
  return [
    { label: 'Position Sizing', value: 'Fixed Safety Margin' },
    { label: 'Safety Margin / Contract', value: String(ps.safety_margin_per_contract) },
    { label: 'Min Contracts', value: String(ps.min_contracts) },
    {
      label: 'Max Contracts',
      value: ps.max_contracts != null ? String(ps.max_contracts) : 'No limit',
    },
  ]
}

export type BuildReportPayloadArgs = {
  results: BacktestResponse
  request: BacktestRequest | null
  initialCapital: number
  equityCurve: EquityPoint[]
  monthlyStats: MonthlyStats[]
  symbol: string
  timeframe: string
}

export function buildReportPayload({
  results,
  request,
  initialCapital,
  equityCurve,
  monthlyStats,
  symbol,
  timeframe,
}: BuildReportPayloadArgs): BacktestReportPayload {
  return {
    generatedAt: formatDisplayDateTime(new Date()),
    config: {
      symbol,
      timeframe,
      start: request?.start ? formatDisplayDate(request.start) : undefined,
      end: request?.end ? formatDisplayDate(request.end) : undefined,
      initialCapital,
      pointValue: request?.point_value,
      strategy: request?.strategy,
      strategyParams: buildStrategyParams(request?.strategy_params),
      positionSizing: buildPositionSizing(request),
    },
    metrics: results.metrics,
    equityCurve: equityCurve.map((p) => ({ equity: p.equity, drawdownPct: p.drawdownPct })),
    monthlyStats: monthlyStats.map((m) => ({
      label: m.label,
      pnl: m.pnl,
      trades: m.trades,
      winRate: m.winRate,
    })),
    trades: results.trades.map((t) => ({
      symbol: t.symbol,
      action: t.action,
      quantity: t.quantity,
      entryTime: formatDisplayDateTime(t.entry_time),
      entryPrice: t.entry_price,
      exitTime: t.exit_time ? formatDisplayDateTime(t.exit_time) : null,
      exitPrice: t.exit_price,
      pnl: t.pnl,
    })),
  }
}

function defaultFileName(symbol: string, timeframe: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const safeSymbol = symbol.replace(/[^a-zA-Z0-9_-]/g, '') || 'backtest'
  return `${safeSymbol}-${timeframe}-backtest-${stamp}.pdf`
}

/**
 * Generates the PDF report via the Rust backend. Opens a native save dialog.
 * Resolves to the saved file path, or `null` if the user cancelled.
 */
export async function generateBacktestReport(args: BuildReportPayloadArgs): Promise<string | null> {
  const payload = buildReportPayload(args)
  const savedPath = await invoke<string | null>('generate_backtest_report', {
    payload,
    defaultFileName: defaultFileName(args.symbol, args.timeframe),
  })
  return savedPath
}
