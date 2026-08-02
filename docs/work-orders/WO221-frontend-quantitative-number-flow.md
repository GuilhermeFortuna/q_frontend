# WO221 — Frontend: Quantitative Number Flow

## Shared context (read first)

Final order; run only after VISUAL F. Selected source: SmoothUI
[Number Flow](https://smoothui.dev/docs/components/number-flow). Inspect/hash obtainable source and
append provenance. Read `StatTile.tsx`, tabular-number design rules, current formatters, live quote
polling, launcher telemetry, and performance instrumentation.

## Goal

Give meaningful live KPI changes directional continuity without making Q's dense data surfaces
restless. Build one reusable numeric-flow primitive, integrate it into `StatTile` via explicit opt-in,
and prove it on live QuotePanel values plus launcher CPU/memory/I/O telemetry.

## Files

```text
src/components/ui/QuantNumberFlow.tsx
src/components/ui/StatTile.tsx
src/components/ui/index.ts
src/components/ui/__tests__/QuantNumberFlow.test.tsx
src/components/ui/__tests__/StatTile.test.tsx
src/components/market/QuotePanel.tsx
src/components/market/__tests__/QuotePanel.test.tsx
src/components/launcher/LauncherDashboard.tsx
src/components/launcher/__tests__/LauncherDashboard.test.tsx
docs/design/premium-component-upgrades.md
docs/design/visual-design-system.md
docs/runtime-performance.md
```

## API and value contract

```ts
type QuantNumberFlowProps = {
  value: number
  format: (value: number) => string
  direction?: 'auto' | 'up' | 'down'
  durationMs?: number // default 220, clamp 120..280
  ariaLabel?: string
}

type StatTileProps = {
  // existing props unchanged
  numericValue?: number
  formatNumericValue?: (value: number) => string
  animateValue?: boolean // default false
}
```

If `animateValue` is false or numeric props are absent, `StatTile` renders its existing `value`
string byte-for-byte. Callers never parse localized strings, currency, percentages, timestamps, or
units back into numbers.

## Implementation contract

1. Preserve the selected component's vertically directional digit transition and stable-width
   glyphs. Use Q tabular numerals and existing caller formatters; decimals, signs, grouping,
   currencies, percent, and unchanged prefix/suffix characters must not jump.
2. Interruptions start from the currently displayed value and converge on the newest value; never
   queue stale intermediate ticks. Non-finite input renders an em dash and announces no false value.
3. Accessibility exposes one final formatted text value, not separate animated digits. Screen readers
   must not announce every intermediate frame. Copy/select yields the final formatted value.
4. Opt in only: QuotePanel Open/High/Low/Last and Volume, plus Launcher CPU Core Load, Engine Memory,
   and Database Disk I/O. `Last Update`, IDs, timestamps, DataTable cells, inputs, historical result
   tiles, and status strings do not animate in this order.
5. Direction may tint only the moving glyph edge very briefly; persistent semantic color continues
   to come from `valueTone`/delta tone. No bounce, glow burst, or width-changing font.
6. Reduced motion and hidden tabs update instantly. Use Motion/CSS presence, not a per-instance RAF.
   Many simultaneous StatTiles must not create global listeners or an animation loop.

## Guardrails

- Do not change data polling, numerical precision, localization, formatters, metric semantics, chart
  rendering, or the existing `value` API.
- Do not automatically animate every `StatTile` consumer. Later rollout requires a separate decision
  based on whether the value is genuinely live and visually benefits.
- No new number-flow package unless source inspection proves the signature cannot be retained with
  existing Motion; stop and report before installing.

## Verification

- Tests: positive/negative/decimal/grouped/unit formatting, rise/fall, unchanged value, rapid updates,
  non-finite input, reduced motion, accessible output, copy text, legacy StatTile parity.
- Quote/launcher tests prove numeric input is passed before formatting and polling is unchanged.
- Run `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm perf:smoke`,
  `git diff --check`.
- Manual with rapidly changing mocked telemetry at 1440x900 and 390x844; reduced motion, hidden tab,
  200% zoom, and screen-reader inspection. Compare FPS/long tasks with and without opt-in animation.

## Definition of done

Live values move with controlled numeric continuity, static numbers stay still, formatting and a11y
remain exact, and no persistent loop appears. Handoff includes source/hash, chosen opt-in inventory,
captures, performance comparison, command results, and stops at `REVIEW` for VISUAL G and batch
acceptance.

## Out of scope

Global StatTile rollout, animated table cells/chart labels, changed precision, or polling/backend work.
