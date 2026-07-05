# WO198 — Frontend: chart frame theme (one visual system for recharts + visx)

## Shared context (read first)

Sixth of the **WO193–WO199 premium-polish batch**; runs after 🔍 Checkpoint A (WO193–195
foundations). **May run in parallel with WO196 and WO197** — work on its own branch; the
only shared files are `/dev/ui` and the design doc (append-only; merge in numeric order).
One soft seam with WO197: `ChartTooltip` uses the `surface-float` class, which WO197
retouches — consume the class name only and the merge is order-independent. 🔍 Checkpoint B
reviews the whole 196–198 lane together. Charts were explicitly
out of scope in the WO116–126 batch ("only their containing surfaces re-skin"), so today
default-looking recharts axes, gray grid lines, and stock tooltips sit _inside_ premium
frosted-glass panels — the contrast makes both look worse. This WO builds one shared chart
theme (colors, type, axes, grids, crosshairs, tooltips) and applies it to every chart, so
the data layer finally matches the shell around it.

Chart _internals stay chart internals_: no data transformations, no new chart types, no
library swaps. This is frame + dressing.

Frontend repo: `q_frontend` — React/TS/Vite/Tailwind, `pnpm` (never npm), vitest. Paths
relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- recharts consumers: `src/components/optimize/ParetoFrontPanel.tsx`,
  `OptimizationScatter.tsx`, `ParamImportancePanel.tsx`,
  `src/components/walkforward/IsOosComparisonChart.tsx`,
  `src/components/research/FeatureStabilityPanel.tsx`,
  `src/components/research/experiments/DiscoveryAbPanel.tsx`,
  `src/components/backtests/MonthlyPnLChart.tsx`, `EquityCurveChart.tsx`,
  `DrawdownChart.tsx` — each currently styles axes/tooltips inline (or not at all).
- visx: `src/components/charts/CandlestickChart.tsx`, `LiveStrategyChart.tsx`, and
  `src/components/charts/layers/` — the flagship market chart; axes/crosshair/overlays
  live in the layers.
- `src/styles/globals.css` — color tokens (brass/gold/silver/carbon ladders, pos/neg
  tones); WO193 type tokens (`--text-2xs`, tabular numerals).
- `src/components/ui/StatTile.tsx` tone conventions — chart pos/neg must match.
- WO113–115 (optimization analytics batch) — those WOs built the recharts panels being
  re-dressed here; their data/interaction logic is untouched.

## Goal

```ts
// src/lib/charts/chartTheme.ts — single source of truth
export const chartTheme = {
  axis: {
    stroke: 'rgba(255,255,255,.10)',
    tick: { fill: 'var(--color-silver-400)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' },
  },
  grid: { stroke: 'rgba(255,255,255,.045)', dash: undefined /* solid hairlines, not dashes */ },
  crosshair: { stroke: 'rgba(214,178,120,.35)' },
  series: [
    /* ordered categorical palette from existing tokens */
  ],
  tooltip: {
    /* consumed by <ChartTooltip /> */
  },
} as const
```

Every chart in the app drawn with the same hairline grids, quiet tabular axes, brass
crosshairs, and one premium tooltip — recognizably the same instrument as the panels
around it.

## Tasks

1. **`src/lib/charts/chartTheme.ts`** per the Goal sketch. Decisions to encode:
   - **Grids/axes are furniture**: low-luminance solid hairlines (no dashed gray defaults),
     no axis domain lines unless the chart needs a baseline (equity/drawdown zero-line is
     tier-1 brass hairline).
   - **Axis type**: WO193 numerals — `--text-2xs`, tabular, slashed-zero, `silver-400`;
     axis titles small-caps tier-1 style, used sparingly.
   - **Series palette**: an ordered categorical ramp derived from existing tokens (gold/
     brass first for "the" series, then silver/steel/muted tones for comparisons; pos/neg
     always the StatTile tones). No new hues outside the token system.
   - **Focus states**: hovered series brightens, others dim to ~45% (recharts
     `activeDot`/opacity; visx layer opacity) — light allocates attention, consistent with
     the accent-ladder philosophy.
2. **`src/components/charts/ChartTooltip.tsx`** — one tooltip component for both stacks:
   `surface-float` material (matches WO197 overlays), `--text-xs` labels + tabular values,
   optional per-series color chips, WO194 `--motion-fast` fade (recharts re-mounts
   tooltips aggressively — ensure no flicker; render via recharts `content={<ChartTooltip/>}`
   and a thin adapter for visx's tooltip data shape).
3. **recharts adapter** — `src/lib/charts/rechartsTheme.tsx`: prop bundles/small wrappers
   (`themedAxisProps`, `themedGridProps`, `<ThemedTooltip />`) so consumers apply the theme
   in one line per element rather than copy-pasting style objects. Migrate all nine
   recharts consumers listed above. Delete their now-dead inline axis/tooltip styling.
4. **visx application** — restyle `CandlestickChart` / `LiveStrategyChart` axes, gridlines,
   and crosshair from `chartTheme`; candle/volume colors keep their existing semantic
   colors but sourced through the theme object so they can't drift. The crosshair + its
   axis-edge readout labels (if present) adopt the brass crosshair + tabular readouts.
5. **Container seam check.** Charts sit on `surface-panel` glass; verify plot backgrounds
   are transparent (no chart-drawn dark rects fighting the panel) and margins are
   consistent (theme exports a standard `margin` object).
6. **Gallery**: a chart section in `/dev/ui` with one themed recharts line/bar/scatter and
   the tooltip — reference rendering for future chart work.

## Guardrails

> **No data/interaction changes**: same props flowing into series, same zoom/brush/click
> behavior, same hooks. If a chart's interaction breaks, the migration went too deep.
> **No new dependencies**; no chart-library version bumps.
> **All colors from tokens** — the theme file may not introduce raw hex values that don't
> exist in `globals.css` (derive rgba from tokens where alpha is needed, comment the source
> token).
> **Perf**: `chartTheme` and prop bundles are module-level constants (stable references —
> recharts re-renders on identity changes; the WO70–72 lessons apply). `ChartTooltip` must
> not cause tooltip-flicker re-mount loops.
> **Reduced motion**: tooltip fade and series dim/brighten respect the WO194 gate (instant
> when reduced).

## Tests

- `src/lib/charts/__tests__/chartTheme.test.ts`: theme values resolve; series palette has
  no duplicates; pos/neg map to the StatTile tone tokens.
- `src/components/charts/__tests__/ChartTooltip.test.tsx`: renders label + tabular values
  - series chips from both the recharts-shaped and visx-shaped payloads.
- Existing chart component suites stay green (they assert data/interaction, which is
  untouched); update any style-assertion expectations.

## Docs

Extend `docs/design/visual-design-system.md`: **Charts** section — theme file location,
the "grids are furniture / light allocates attention" rules, the palette order, and the
rule that new charts must consume `chartTheme` (no inline axis styling ever again).

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the shipped `chartTheme` object, the list of all migrated chart files
(expect ≥ 11), and confirmation that no chart interaction changed (name the manual checks
run: candlestick crosshair + zoom, optimization scatter hover, equity tooltip). Production
trigger: none — themed charts render wherever they already render.

## Out of scope

New chart types or panels; virtualized/downsampled rendering changes; chart _containing
panel_ work (done in WO122–126); the DOM overlay primitives (WO197); axis/scale logic;
export-as-image.
