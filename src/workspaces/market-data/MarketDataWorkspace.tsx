import { useInstruments, useMarketSnapshot, useOhlcv } from '@/api/queries/market-data'
import { OhlcvChart } from '@/components/charts/OhlcvChart'
import { InstrumentsTable } from '@/components/tables/InstrumentsTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/useAppStore'

function formatPrice(value: number, symbol: string) {
  const decimals = symbol.includes('USD') && symbol.length > 6 ? 2 : symbol === 'EURUSD' ? 4 : 2
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function MarketDataWorkspace() {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol)
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol)

  const instrumentsQuery = useInstruments()
  const snapshotQuery = useMarketSnapshot(selectedSymbol)
  const ohlcvQuery = useOhlcv(selectedSymbol)

  const snapshot = snapshotQuery.data

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-silver-100">Market Data</h1>
        <p className="text-sm text-silver-400">
          Instrument browser with snapshot and OHLCV series (MSW mock until q_backend is wired).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Instruments</CardTitle>
            <CardDescription>Select a symbol to load chart data.</CardDescription>
          </CardHeader>
          <CardContent>
            {instrumentsQuery.isLoading ? (
              <p className="text-sm text-silver-400">Loading instruments…</p>
            ) : instrumentsQuery.data ? (
              <InstrumentsTable
                data={instrumentsQuery.data}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
              />
            ) : (
              <p className="text-sm text-red-300">Failed to load instruments.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-mono">{selectedSymbol}</CardTitle>
              <CardDescription>Live snapshot (mock)</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshotQuery.isLoading ? (
                <p className="text-sm text-silver-400">Loading snapshot…</p>
              ) : snapshot ? (
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-silver-400">Last</dt>
                    <dd className="font-mono text-lg text-silver-100">
                      {formatPrice(snapshot.last, snapshot.symbol)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-silver-400">Change</dt>
                    <dd
                      className={
                        snapshot.changePct >= 0
                          ? 'font-mono text-brass-400'
                          : 'font-mono text-red-300'
                      }
                    >
                      {snapshot.changePct >= 0 ? '+' : ''}
                      {snapshot.changePct.toFixed(2)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-silver-400">Volume</dt>
                    <dd className="font-mono text-silver-100">
                      {snapshot.volume.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-red-300">Snapshot unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OHLCV</CardTitle>
              <CardDescription>Close price series · 30 sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {ohlcvQuery.isLoading ? (
                <p className="text-sm text-silver-400">Loading OHLCV…</p>
              ) : ohlcvQuery.data ? (
                <OhlcvChart data={ohlcvQuery.data} symbol={selectedSymbol} />
              ) : (
                <p className="text-sm text-red-300">OHLCV unavailable.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
