import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { startBacktest } from '@/api/queries/backtests'
import { csvBaseName, exportBacktestCsv } from '@/lib/reports/backtestCsvExport'
import { handlers } from '@/mocks/handlers'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  invoke.mockReset()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('csvBaseName', () => {
  it('builds a filesystem-safe base name from symbol, timeframe and date', () => {
    expect(csvBaseName('WIN$', 'M5', new Date('2024-03-09T12:00:00Z'))).toBe(
      'WIN-M5-backtest-2024-03-09',
    )
    expect(csvBaseName('$$', 'D1', new Date('2024-03-09T12:00:00Z'))).toBe(
      'backtest-D1-backtest-2024-03-09',
    )
  })
})

describe('exportBacktestCsv', () => {
  it('hands both CSV bodies to the native export command', async () => {
    const { run_id: runId } = await startBacktest({ symbol: 'PETR4', timeframe: 'M5' })
    invoke.mockResolvedValue(['/tmp/a-market-data.csv', '/tmp/a-trades.csv'])

    const saved = await exportBacktestCsv({ runId, symbol: 'PETR4', timeframe: 'M5' })

    expect(saved).toEqual(['/tmp/a-market-data.csv', '/tmp/a-trades.csv'])
    expect(invoke).toHaveBeenCalledTimes(1)
    const [command, args] = invoke.mock.calls[0]
    expect(command).toBe('export_backtest_csv')
    expect(args.baseName).toBe(csvBaseName('PETR4', 'M5'))
    expect(args.marketDataCsv.split('\n')[0]).toMatch(/^time,open,high,low,close,volume,/)
    expect(args.tradesCsv.split('\n')[0]).toBe(
      'trade_id,symbol,side,entry_time,entry_price,exit_time,exit_price,pnl,quantity,commission,point_value,exit_reason',
    )
    expect(args.tradesCsv.trim().split('\n').length).toBeGreaterThan(1)
  })

  it('resolves to null when the folder dialog is cancelled', async () => {
    const { run_id: runId } = await startBacktest({ symbol: 'PETR4', timeframe: 'M5' })
    invoke.mockResolvedValue(null)

    await expect(exportBacktestCsv({ runId, symbol: 'PETR4', timeframe: 'M5' })).resolves.toBeNull()
  })

  it('explains a run without stored CSV data and never opens the dialog', async () => {
    await expect(
      exportBacktestCsv({ runId: 'unknown-run', symbol: 'PETR4', timeframe: 'M5' }),
    ).rejects.toThrow('CSV data is not stored for this run')
    expect(invoke).not.toHaveBeenCalled()
  })
})
