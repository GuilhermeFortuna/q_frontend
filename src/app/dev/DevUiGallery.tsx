import { useState, useMemo, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
} from 'recharts'

import { ChartTooltip } from '@/components/charts/ChartTooltip'
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  EntityCard,
  FilterPills,
  LabeledField,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  Panel,
  PanelHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeChips,
  RangeInput,
  SectionHeader,
  SegmentedToggle,
  StatTile,
  DataTable,
  toast,
  Tooltip,
  type DataColumn,
} from '@/components/ui'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedTooltip,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
} from '@/lib/charts/rechartsTheme'
import { cn } from '@/lib/utils'

function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} />
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

function StateCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-silver-500 text-[10px] font-semibold tracking-wide uppercase">{label}</p>
      {children}
    </div>
  )
}

interface SampleData {
  id: string
  strategy: string
  sharpe: number
  pnl: number
  trades: number
  status: string
}

const sampleRows: SampleData[] = Array.from({ length: 50 }, (_, i) => ({
  id: `strat-${i + 1}`,
  strategy: `Strategy Alpha-${100 + i}`,
  sharpe: parseFloat((1.2 + Math.sin(i) * 0.8).toFixed(2)),
  pnl: Math.round(15000 * Math.cos(i) - 2000 * Math.sin(i / 2)),
  trades: Math.round(80 + Math.sin(i * 3) * 50),
  status: i % 5 === 0 ? 'Flagged' : i % 7 === 0 ? 'Error' : 'Completed',
}))

const galleryLineData = [
  { label: 'W1', equity: 100_000 },
  { label: 'W2', equity: 102_400 },
  { label: 'W3', equity: 101_800 },
  { label: 'W4', equity: 105_200 },
]

const galleryBarData = [
  { label: 'Jan', pnl: 1200 },
  { label: 'Feb', pnl: -800 },
  { label: 'Mar', pnl: 2400 },
]

const galleryScatterData = [
  { x: 0.12, y: 1.4, n: 1 },
  { x: 0.18, y: 1.1, n: 2 },
  { x: 0.22, y: 1.8, n: 3 },
  { x: 0.31, y: 1.5, n: 4 },
]

export function DevUiGallery() {
  const [singleMode, setSingleMode] = useState<'any' | 'all' | 'majority'>('any')
  const [multiModes, setMultiModes] = useState<string[]>(['ema'])
  const [datePreset, setDatePreset] = useState('3M')
  const [filter, setFilter] = useState('all')
  const [entitySelected, setEntitySelected] = useState(false)
  const [range, setRange] = useState({ min: 10, max: 50, step: 5 as number | null })
  const [selectedRowId, setSelectedRowId] = useState<string | null>('strat-2')
  const [tableLoading, setTableLoading] = useState(false)
  const [tableEmpty, setTableEmpty] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const tableColumns = useMemo<DataColumn<SampleData>[]>(
    () => [
      { id: 'id', header: 'ID', width: '60px', sticky: true },
      { id: 'strategy', header: 'Strategy Name', sortable: true, minWidth: '180px' },
      { id: 'sharpe', header: 'Sharpe Ratio', align: 'right', numeric: true, sortable: true },
      {
        id: 'pnl',
        header: 'PnL ($)',
        align: 'right',
        numeric: true,
        tone: 'signed',
        sortable: true,
        render: (row) =>
          row.pnl.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }),
      },
      { id: 'trades', header: 'Trades', align: 'right', numeric: true, sortable: true },
      {
        id: 'status',
        header: 'Status',
        align: 'center',
        render: (row) => (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase',
              row.status === 'Completed'
                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : row.status === 'Flagged'
                  ? 'border border-amber-500/20 bg-amber-500/10 text-amber-300'
                  : 'border border-rose-500/20 bg-rose-500/10 text-rose-400',
            )}
          >
            {row.status}
          </span>
        ),
      },
    ],
    [],
  )

  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-silver-100 text-2xl font-semibold">UI primitive gallery</h1>
        <p className="text-silver-400 text-sm">
          WO117 dev surface — every primitive on a real panel background.
        </p>
      </header>

      <Panel className="space-y-8 p-4">
        <PanelHeader title="Panel + PanelHeader" right="3 items" />

        <section className="space-y-4">
          <SectionHeader title="Materials Vocabulary" />
          <div className="surface-well border-carbon-700/60 rounded-xl border p-5">
            <p className="text-silver-400 mb-4 text-xs">
              Material Vocabulary v2 comparison. Hover, click/press, and tab to focus elements to
              inspect their physical behaviors.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Glass Material */}
              <div className="space-y-3">
                <h4 className="text-silver-200 text-xs font-semibold tracking-wider uppercase">
                  Glass (Space - 0 Reference)
                </h4>
                <div className="space-y-2">
                  <div className="surface-panel text-silver-300 flex min-h-[80px] items-center justify-center rounded-xl p-4 text-xs">
                    Panel (Static)
                  </div>
                  <div className="surface-panel surface-panel--living text-silver-300 flex min-h-[80px] cursor-pointer items-center justify-center rounded-xl p-4 text-xs">
                    Living Panel (Hover to see spotlight)
                  </div>
                </div>
              </div>

              {/* Suede Material */}
              <div className="space-y-3">
                <h4 className="text-silver-200 text-xs font-semibold tracking-wider uppercase">
                  Suede (Touch - +1 Controls)
                </h4>
                <div className="space-y-2">
                  <button className="surface-suede text-silver-100 focus-visible:outline-brass-500 flex min-h-[80px] w-full flex-col items-center justify-center gap-1 rounded-xl p-4 text-xs transition-[transform,opacity,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-exit)] hover:duration-[var(--motion-base)] hover:ease-[var(--ease-out)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-[0.5px] active:scale-[0.985] active:duration-[var(--motion-fast)] active:ease-[var(--ease-out)]">
                    <span>Suede Button</span>
                    <span className="text-silver-400 font-mono text-[10px]">
                      (Hover & click/press)
                    </span>
                  </button>
                  <button
                    disabled
                    className="surface-suede text-silver-100 flex min-h-[80px] w-full cursor-not-allowed items-center justify-center rounded-xl p-4 text-xs opacity-50"
                  >
                    Disabled Suede
                  </button>
                </div>
              </div>

              {/* Brass Material */}
              <div className="space-y-3">
                <h4 className="text-silver-200 text-xs font-semibold tracking-wider uppercase">
                  Machined Brass (Jewelry - Primary CTA)
                </h4>
                <div className="space-y-2">
                  <button className="button-machined-brass focus-visible:outline-brass-500 flex min-h-[80px] w-full flex-col items-center justify-center gap-1 rounded-xl p-4 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-[0.5px] active:scale-[0.985]">
                    <span>Machined Brass Button</span>
                    <span className="text-carbon-900 font-mono text-[10px] font-semibold">
                      (Tier-4 Gold Accent)
                    </span>
                  </button>
                  <button
                    disabled
                    className="button-machined-brass flex min-h-[80px] w-full cursor-not-allowed items-center justify-center rounded-xl p-4 text-xs opacity-50"
                  >
                    Disabled Brass
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="DataTable Primitive" />
          <div className="surface-well border-carbon-700/60 space-y-4 rounded-xl border p-5">
            <div className="flex items-center gap-4">
              <label className="text-silver-400 flex cursor-pointer items-center gap-2 text-xs select-none">
                <input
                  type="checkbox"
                  checked={tableLoading}
                  onChange={(e) => setTableLoading(e.target.checked)}
                  className="border-carbon-750 bg-carbon-900 text-brass-500 rounded focus:ring-0 focus:ring-offset-0"
                />
                Loading State
              </label>
              <label className="text-silver-400 flex cursor-pointer items-center gap-2 text-xs select-none">
                <input
                  type="checkbox"
                  checked={tableEmpty}
                  onChange={(e) => setTableEmpty(e.target.checked)}
                  className="border-carbon-750 bg-carbon-900 text-brass-500 rounded focus:ring-0 focus:ring-offset-0"
                />
                Empty State
              </label>
              <span className="text-silver-500 text-[10px] italic">
                * Sticky ID column enabled. Click headers to sort (uncontrolled). Click rows to
                select.
              </span>
            </div>
            <div className="border-carbon-700/60 max-h-[300px] overflow-hidden overflow-y-auto rounded-xl border">
              <DataTable
                columns={tableColumns}
                rows={tableEmpty ? [] : sampleRows}
                rowKey={(r) => r.id}
                selectedKey={selectedRowId}
                onRowClick={(r) => setSelectedRowId(r.id)}
                loading={tableLoading}
              />
            </div>
          </div>
        </section>

        <GallerySection title="SectionHeader">
          <StateCard label="Default">
            <SectionHeader title="Instrument & Modeling" right="Optional slot" />
          </StateCard>
        </GallerySection>

        <GallerySection title="LabeledField">
          <StateCard label="Default">
            <LabeledField label="Fast period" hint="Number of bars for the fast moving average.">
              <input className={wellInputClass} defaultValue="12" aria-label="Fast period" />
            </LabeledField>
          </StateCard>
          <StateCard label="Error">
            <LabeledField label="Slow period" error="Must be greater than fast period.">
              <input className={wellInputClass} defaultValue="4" aria-label="Slow period" />
            </LabeledField>
          </StateCard>
        </GallerySection>

        <GallerySection title="SegmentedToggle">
          <StateCard label="Single select">
            <SegmentedToggle
              aria-label="Entry manager mode"
              options={[
                { value: 'any', label: 'Any (OR)' },
                { value: 'all', label: 'All (AND)' },
                { value: 'majority', label: 'Majority' },
              ]}
              value={singleMode}
              onChange={setSingleMode}
            />
          </StateCard>
          <StateCard label="Multi select">
            <SegmentedToggle
              mode="multi"
              aria-label="Moving average types"
              options={[
                { value: 'ema', label: 'EMA' },
                { value: 'hma', label: 'HMA' },
                { value: 'sma', label: 'SMA' },
              ]}
              values={multiModes}
              onToggle={(value) =>
                setMultiModes((current) =>
                  current.includes(value)
                    ? current.filter((item) => item !== value)
                    : [...current, value],
                )
              }
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="RangeChips">
          <StateCard label="Presets">
            <RangeChips
              options={[
                { value: '1M', label: '1M', title: 'Last 1 month' },
                { value: '3M', label: '3M', title: 'Last 3 months' },
                { value: '6M', label: '6M' },
                { value: '1Y', label: '1Y' },
                { value: 'YTD', label: 'YTD' },
                { value: 'ALL', label: 'All' },
              ]}
              value={datePreset}
              onSelect={setDatePreset}
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="FilterPills">
          <StateCard label="Categories">
            <FilterPills
              options={[
                { value: 'all', label: 'All' },
                { value: 'trend', label: 'Trend' },
                { value: 'mean-reversion', label: 'Mean reversion' },
                { value: 'breakout', label: 'Breakout' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="EntityCard">
          <StateCard label="Default">
            <EntityCard
              title="Dual MA crossover"
              tag="Trend"
              description="Classic fast/slow moving-average crossover with configurable periods."
              meta="4 params"
              selected={false}
              onSelect={() => undefined}
            />
          </StateCard>
          <StateCard label="Selected">
            <EntityCard
              title="RSI mean reversion"
              tag="Mean reversion"
              description="Buys oversold and sells overbought using RSI thresholds."
              meta="3 params"
              selected={entitySelected}
              onSelect={() => setEntitySelected((value) => !value)}
            />
          </StateCard>
          <StateCard label="Disabled">
            <EntityCard
              title="Locked strategy"
              description="Unavailable in the current workspace."
              selected={false}
              disabled
              onSelect={() => undefined}
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="RangeInput">
          <StateCard label="Default">
            <RangeInput min={range.min} max={range.max} step={range.step} onChange={setRange} />
          </StateCard>
          <StateCard label="Error">
            <RangeInput
              min={80}
              max={20}
              step={0}
              onChange={() => undefined}
              error="Custom range validation failed."
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="StatTile">
          <StateCard label="Neutral">
            <StatTile label="Completed trials" value="128" />
          </StateCard>
          <StateCard label="Delta up">
            <StatTile label="Net profit" value="+12.4%" delta="+2.1% vs prior" deltaTone="up" />
          </StateCard>
          <StateCard label="Delta down">
            <StatTile label="Max drawdown" value="-8.2%" delta="-1.4% vs prior" deltaTone="down" />
          </StateCard>
        </GallerySection>

        <section className="space-y-4">
          <SectionHeader title="Chart frame theme (WO198)" />
          <div className="surface-well border-carbon-700/60 grid gap-4 rounded-xl border p-5 lg:grid-cols-2">
            <StateCard label="Line (themed recharts)">
              <div className="border-carbon-700/60 h-[200px] rounded-lg border bg-transparent p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={galleryLineData} margin={chartMargin}>
                    <ThemedCartesianGrid vertical={false} />
                    <ThemedXAxis dataKey="label" />
                    <ThemedYAxis width={56} />
                    <ThemedTooltip />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      stroke={chartTheme.semantic.equity}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </StateCard>

            <StateCard label="Bar (pos/neg semantic)">
              <div className="border-carbon-700/60 h-[200px] rounded-lg border bg-transparent p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={galleryBarData} margin={chartMargin}>
                    <ThemedCartesianGrid vertical={false} />
                    <ThemedXAxis dataKey="label" />
                    <ThemedYAxis width={48} />
                    <ThemedTooltip />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {galleryBarData.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={
                            entry.pnl >= 0
                              ? chartTheme.semantic.positive
                              : chartTheme.semantic.negative
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </StateCard>

            <StateCard label="Scatter">
              <div className="border-carbon-700/60 h-[200px] rounded-lg border bg-transparent p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ ...chartMargin, bottom: 8 }}>
                    <ThemedCartesianGrid />
                    <ThemedXAxis type="number" dataKey="x" name="Return" />
                    <ThemedYAxis type="number" dataKey="y" name="Sharpe" width={48} />
                    <ThemedTooltip />
                    <Scatter data={galleryScatterData} fill={chartTheme.series.primary} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </StateCard>

            <StateCard label="ChartTooltip shell">
              <ChartTooltip
                active
                label="Trial #12"
                items={[
                  { name: 'Sharpe', value: '1.42', color: chartTheme.series.primary },
                  { name: 'Max DD', value: '-6.8%', color: chartTheme.semantic.negative },
                ]}
              />
            </StateCard>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Overlay System" />
          <div className="surface-well border-carbon-700/60 grid gap-4 rounded-xl border p-5 md:grid-cols-2">
            <StateCard label="Dialog">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="border-carbon-700/60 bg-carbon-900/50 text-silver-200 hover:bg-carbon-800/70 rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
                  >
                    Open dialog
                  </button>
                </DialogTrigger>
                <DialogContent size="sm">
                  <DialogHeader title="Sample dialog" />
                  <p className="text-silver-400 text-sm">Modal work surface at +2 elevation.</p>
                </DialogContent>
              </Dialog>
            </StateCard>

            <StateCard label="ConfirmDialog">
              <button
                type="button"
                className="border-carbon-700/60 bg-carbon-900/50 text-silver-200 hover:bg-carbon-800/70 rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
                onClick={() => setConfirmOpen(true)}
              >
                Open confirm
              </button>
              <ConfirmDialog
                open={confirmOpen}
                title="Delete study?"
                description="This removes the study from history."
                onConfirm={() => setConfirmOpen(false)}
                onCancel={() => setConfirmOpen(false)}
              />
            </StateCard>

            <StateCard label="Popover">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="border-carbon-700/60 bg-carbon-900/50 text-silver-200 hover:bg-carbon-800/70 rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
                  >
                    Chart settings style
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 space-y-2">
                  <p className="text-silver-300 text-xs">Anchored float panel</p>
                  <p className="text-silver-500 text-[10px]">Origin-aware scale-in, no arrow.</p>
                </PopoverContent>
              </Popover>
            </StateCard>

            <StateCard label="Menu">
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    className="border-carbon-700/60 bg-carbon-900/50 text-silver-200 hover:bg-carbon-800/70 rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
                  >
                    Actions
                  </button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem shortcut="⌘D">Duplicate</MenuItem>
                  <MenuItem destructive>Delete</MenuItem>
                  <MenuSeparator />
                  <MenuSub>
                    <MenuSubTrigger>Export</MenuSubTrigger>
                    <MenuSubContent>
                      <MenuItem>JSON</MenuItem>
                      <MenuItem>CSV</MenuItem>
                    </MenuSubContent>
                  </MenuSub>
                </MenuContent>
              </Menu>
            </StateCard>

            <StateCard label="Tooltip">
              <Tooltip content="Sharpe ratio, annualized">
                <button
                  type="button"
                  className="border-carbon-700/60 bg-carbon-900/50 text-silver-200 hover:bg-carbon-800/70 rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
                >
                  Hover metric
                </button>
              </Tooltip>
            </StateCard>

            <StateCard label="Toast">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="border-brass-600/30 bg-brass-600/10 text-brass-400 rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
                  onClick={() => toast.success('Strategy saved')}
                >
                  Success
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 uppercase"
                  onClick={() => toast.error('Export failed')}
                >
                  Error
                </button>
                <button
                  type="button"
                  className="border-carbon-700/60 bg-carbon-900/50 text-silver-200 rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
                  onClick={() => toast.info('Background sync complete')}
                >
                  Info
                </button>
              </div>
            </StateCard>
          </div>
        </section>
      </Panel>
    </div>
  )
}
