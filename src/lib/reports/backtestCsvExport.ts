import { invoke } from '@tauri-apps/api/core'
import axios from 'axios'

import { fetchBacktestMarketDataCsv, fetchBacktestTradesCsv } from '@/api/queries/backtests'

export type ExportBacktestCsvArgs = {
  runId: string
  symbol: string
  timeframe: string
}

export function csvBaseName(symbol: string, timeframe: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  const safeSymbol = symbol.replace(/[^a-zA-Z0-9_-]/g, '') || 'backtest'
  return `${safeSymbol}-${timeframe}-backtest-${stamp}`
}

/**
 * Exports the run's market data (bars plus every computed indicator) and its
 * trades as two CSV files. Opens a native folder dialog and writes
 * `<base>-market-data.csv` and `<base>-trades.csv` there.
 * Resolves to the saved file paths, or `null` if the user cancelled.
 */
export async function exportBacktestCsv({
  runId,
  symbol,
  timeframe,
}: ExportBacktestCsvArgs): Promise<string[] | null> {
  let marketDataCsv: string
  let tradesCsv: string
  try {
    // Fetch first so a missing export surfaces before the dialog opens.
    ;[marketDataCsv, tradesCsv] = await Promise.all([
      fetchBacktestMarketDataCsv(runId),
      fetchBacktestTradesCsv(runId),
    ])
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error('CSV data is not stored for this run. Re-run the backtest to export it.')
    }
    throw error
  }

  return invoke<string[] | null>('export_backtest_csv', {
    marketDataCsv,
    tradesCsv,
    baseName: csvBaseName(symbol, timeframe),
  })
}
