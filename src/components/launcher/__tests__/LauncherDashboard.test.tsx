import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: unknown; to: string }) => (
    <a href={to}>{children as never}</a>
  ),
}))

vi.mock('@/api/queries/market-data', () => ({
  useMarketSnapshots: () => ({ data: {} }),
  useInstruments: () => ({ data: [] }),
  useSearchSymbols: () => ({ data: [], isFetching: false }),
}))

vi.mock('@/api/queries/system', () => ({
  useSystemHealth: () => ({ data: { backendVersion: '1.0.0', status: 'ok' } }),
}))

vi.mock('@/api/queries/backtests', () => ({
  useBacktestHistory: () => ({ data: { items: [] } }),
}))

vi.mock('@/api/queries/news', () => ({
  useNewsList: () => ({
    data: [],
    isPending: false,
    refetch: vi.fn(),
    isRefetching: false,
  }),
}))

vi.mock('@/hooks/useActiveJobs', () => ({
  useActiveJobs: () => ({}),
}))

vi.mock('@/hooks/useSparklines', () => ({
  useSparklines: () => ({}),
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn(),
}))

const statTileCalls: Array<Record<string, unknown>> = []

vi.mock('@/components/ui/StatTile', () => ({
  StatTile: (props: Record<string, unknown>) => {
    statTileCalls.push(props)
    return (
      <div data-testid={`stat-tile-${String(props.label)}`}>
        {String(props.label)}:{String(props.value)}
      </div>
    )
  },
}))

import { LauncherDashboard } from '@/components/launcher/LauncherDashboard'

describe('LauncherDashboard telemetry number flow', () => {
  beforeEach(() => {
    statTileCalls.length = 0
    setIntervalSpy.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('opts CPU / memory / disk StatTiles into numeric formatters without changing the 2500ms poll', () => {
    render(<LauncherDashboard />)

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2500)

    const byLabel = Object.fromEntries(
      statTileCalls
        .filter((call) => typeof call.label === 'string')
        .map((call) => [call.label as string, call]),
    )

    expect(byLabel['CPU Core Load']).toMatchObject({
      numericValue: 24,
      animateValue: true,
      value: '24%',
    })
    expect(typeof byLabel['CPU Core Load'].formatNumericValue).toBe('function')
    expect((byLabel['CPU Core Load'].formatNumericValue as (v: number) => string)(24)).toBe('24%')

    expect(byLabel['Engine Memory']).toMatchObject({
      numericValue: 48.2,
      animateValue: true,
      value: '48.2%',
    })
    expect((byLabel['Engine Memory'].formatNumericValue as (v: number) => string)(48.2)).toBe(
      '48.2%',
    )

    expect(byLabel['Database Disk I/O']).toMatchObject({
      numericValue: 8.4,
      animateValue: true,
      value: '8.4 MB/s',
    })
    expect((byLabel['Database Disk I/O'].formatNumericValue as (v: number) => string)(8.4)).toBe(
      '8.4 MB/s',
    )

    expect(screen.getByTestId('stat-tile-CPU Core Load')).toHaveTextContent('CPU Core Load:24%')
  })
})
