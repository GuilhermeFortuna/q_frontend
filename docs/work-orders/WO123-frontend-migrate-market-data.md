# WO123 — Frontend: migrate Market Data onto the design system

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md`. Depends on **WO116/117**, follows **WO118**. Mechanical,
behavior-preserving swap; APIs locked at Checkpoint B.

**Principle:** swap inline idioms for `ui/` primitives, no logic/store changes. Market Data is the
highest-density / most chrome-heavy page (multiple resizable panels, toolbars, ribbons) — pay attention to
the `−2` well vs `+1` raised distinction so toolbars/quote wells read recessed and panels read as the plane.

## How the pieces work today (read these files)

- `src/workspaces/market-data/MarketDataWorkspace.tsx` — shell (uses `react-resizable-panels`).
- `src/components/market/` — `ChartPanel.tsx`, `ChartToolbar.tsx`, `DetailZone.tsx`, `DrawingRail.tsx`,
  `InstrumentInfoPanel.tsx`, `MarketWatchPanel.tsx`, `QuotePanel.tsx`, `QuoteRibbon.tsx`,
  `TimeAndSalesPanel.tsx`, `SymbolCommandPalette.tsx`, `ChangeBadge.tsx`. Resize handles use the
  `market-panel-resize-handle` utility (keep it; it already references brass).

## Goal

Market Data adopts the elevation ladder: panels at level 0, toolbars/quote rows as `−2` wells, badges/cards
at `+1`, the symbol command palette as a `+2` overlay.

## Tasks

1. **Panels/headers** — each market panel → `Panel`/`PanelHeader`; section labels → `SectionHeader`.
2. **Toolbars & ribbons** — `ChartToolbar`, `QuoteRibbon`, `DrawingRail` backgrounds → `surface-well`
   (recessed); toolbar buttons → `Button`/`SegmentedToggle` where they're mode pickers (timeframe, chart
   type).
3. **Command palette** — `SymbolCommandPalette` → `surface-overlay` (+2) treatment.
4. **Badges/tiles** — `ChangeBadge`, quote stats → `StatTile` / tier-aware up/down coloring (green/rose, not
   gold). Keep `FlashOnChange` / `price-flash-*` behavior.
5. **Parity** — resizing, drawing, watchlist selection, time-and-sales streaming all behave identically.

## Guardrails

> Behavior-preserving re-skin only. Keep `react-resizable-panels` wiring and `market-panel-resize-handle`.
> Price-flash + live streaming utilities (`price-flash-up/down`, `live-status-dot`) stay — they are the
> tier-3/4 accents for this page. No inline gradients, no new deps.
> Charts (`visx`/`d3`/candlestick) internals untouched; only their frames re-skin.

## Tests

- Update market tests where markup changed (role/label queries). Suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: tick WO123.

## Definition of done

- `pnpm test:run` green, typecheck clean, `pnpm build` succeeds — **do not report completion until all pass.**
- Paste-in-final-message: confirm Market Data parity + correct well/panel/overlay levels; list files changed.

## Out of scope

- Other pages (**WO122, WO124–126**); chart-engine changes; any market behavior change.
