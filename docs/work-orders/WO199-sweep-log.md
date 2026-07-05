# WO199 — Premium polish sweep log

Format: `page · checklist# · file · what`

## 1. Backtests (Simulation + Optimization + Strategy Studio)

- Backtests · #4,#6 · BacktestResultsTabs.tsx · Tab strip: `text-2xs font-[560]`, active tab silver label + brass border, removed gold text-shadow
- Backtests · #4 · BacktestResultsTabs.tsx · Trade action chips: `text-[9px] font-bold` → `text-2xs font-[560]`
- Backtests · #4,#6 · OptimizeConfigForm.tsx · Page title demoted to tier-0 display heading (silver, `font-display`)
- Backtests · #2,#4,#6 · OptimizationProgress.tsx · Progress labels → `accent-wayfinding`; pct → `quant-tabular-nums` silver
- Backtests · #4 · OptimizeMarketConfigBand.tsx · Section/field labels → `accent-wayfinding text-2xs font-[560]`
- Backtests · #9 · OptimizationTerrain3D.tsx · Axis `<select>` elements use `wellInputClass`
- Backtests · #4,#6 · StrategyBuilderWorkspace.tsx · Title + icon tile demoted to structural tier; name/desc labels → wayfinding
- Backtests · #4 · AiStrategyPanel.tsx · Preview section headers → `accent-wayfinding`
- Backtests · #4 · CollapsedOptimizeResultsTeaser.tsx · Teaser labels → wayfinding scale

## 2. Discover (+ Research / Experiments)

- Discover · #4,#6 · DiscoverConfigForm.tsx · Page title demoted to tier-0 display heading
- Discover · #2,#4,#6 · DiscoverProgress.tsx · HUD labels → wayfinding; generation pct → tabular silver
- Discover · #4 · LeaderboardTable.tsx · Generation badge → `text-2xs font-[560]`
- Discover · #9 · FeatureLab.tsx · Target `<select>` uses `wellInputClass`
- Discover · #9 · LiveSwarmVisualizer3D.tsx · Z-axis `<select>` uses `wellInputClass`
- Discover · #4 · FeatureLabFeaturePicker.tsx · Section label → wayfinding

## 3. Market Data

- Market Data · #4,#6 · MarketWatchPanel.tsx · “Add Symbol” header demoted to wayfinding (was decorative brass)
- Market Data · #4 · ChartToolbar.tsx · Toolbar section label → wayfinding
- Market Data · #4 · QuoteRibbon.tsx · “Last” label weight → `font-[560]`

## 4. Launcher

- Launcher · #2,#4 · LauncherDashboard.tsx · Watchlist change % → `text-2xs font-[560] quant-tabular-nums`; empty-state copy on scale
- Launcher · #4 · LauncherDashboard.tsx · Backend status pill label → wayfinding weight

## 5. Walkforward + Validate

- Walkforward · #4,#6 · WalkForwardConfigForm.tsx · Page title demoted to tier-0 display heading
- Walkforward · #2,#4,#6 · WalkForwardProgress.tsx · HUD labels → wayfinding; pct → tabular silver
- Walkforward · #4 · WalkForwardHistoryPanel.tsx · Column micro-labels `text-[8px]` → `text-2xs`

## 6. Storage + System + News

- Storage · #4,#6 · StorageWorkspace.tsx · Page title + icon tile demoted; inventory symbol column silver (was brass bold)
- Storage · #6 · StorageWorkspace.tsx · Timeframe range labels demoted from brass to silver wayfinding
- Storage · #4 · StorageWorkspace.tsx · KindBadge → `text-2xs`
- System · #4,#6 · SystemWorkspace.tsx · Page title demoted to tier-0 display heading
- News · #4 · NewsReaderWorkspace.tsx · Loading caption → wayfinding scale

## 7. App chrome

- App chrome · #4 · AppShell.tsx · Phase pill label → `text-2xs font-[560]`
- App chrome · #4,#6 · AppDock.tsx · Nav labels → `text-2xs font-[560]`; active link `font-semibold` (was bold gold stack)

## Docs / tests

- Docs · — · materials.test.ts · Assert `::selection` defined exactly once in globals.css
- Docs · — · visual-design-system.md · WO193–199 batch marked complete + “Definition of premium” checklist

## DEFERRED

- Discover · #9 · research/experiments/\* (EncoderAblationPanel, AlphaResearchPanel, NeuralTrainForm) · Multiple native `<select>` still use hand-rolled classes — same fix as FeatureLab; deferred to keep sweep diff reviewable per area
- Backtests · #4 · EquityCurveChart.tsx inline legend `text-[8px]`/`text-[9px]` · Chart micro-legend; WO198 owns chart frame — tune in follow-up if needed
- Market Data · #4 · ChartSettingsPopover / IndicatorsModal · Dense popover micro-type; functional HUD, not page chrome
- All · #3 · Execution workspace · Out of WO199 page-area partition (WO122–126 batch already marked complete)

## Addendum: AI Builder (WO202)

- AI Builder · #1,#2,#7 · StrategyBuilderWorkspace.tsx · Consolidated the authoring band into one max-w-6xl full-height builder surface; aligned draft fields and actions and removed the redundant workspace scrollbar footprint.
- AI Builder · #3,#4,#6 · AiStrategyPanel.tsx · Added dedicated-workspace header suppression, adopted LabeledField and Button materials, and reserved machined brass exclusively for Interpret.
- AI Builder · #5,#7 · AiChatTranscript.tsx · Made the transcript the flexing scroll region and replaced the dead empty state with three focusable prompt chips covering trend, mean-reversion, and breakout starts.
- AI Builder · #5,#8,#9,#10 · page audit · Preserved loading/error/empty model states and 16px inline icon discipline, reused surface-well/native focus treatment, and removed superseded one-off control styling without adding new primitives.
