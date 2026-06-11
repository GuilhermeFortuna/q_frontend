# WO11 — Frontend: quote-board watchlist, command palette, terminal polish

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Lint: `pnpm lint`
  - Unit tests use Vitest + Testing Library + **MSW**.

**Context for this work:** the Market page is being upgraded into a Bloomberg-style
terminal. Prerequisites already merged: WO8 (live polled quotes, enriched `MarketSnapshot`
with bid/ask/digits, price-flash helper, `formatPrice(value, digits)` in
`src/lib/market/format.ts`) and WO9 (page decomposed into `src/components/market/` —
`MarketWatchPanel`, `QuoteRibbon`, `SymbolCommandPalette`, `DrawingRail`, etc., with
`parseTimeframeInput` extracted to `src/lib/market/timeframeCommands.ts` and a
`useWatchlist` hook in `src/hooks/`). WO10 may or may not have merged; this work order
must not conflict with it (it only touches DetailZone tabs — stay out of that file).

This is the final **polish pass**: information density, micro-interactions, and command
power. This work order is **frontend only.** No new dependencies.

---

## Read these files first

- `src/components/market/MarketWatchPanel.tsx` — the watchlist you're upgrading.
- `src/components/market/SymbolCommandPalette.tsx` + `src/lib/market/timeframeCommands.ts`
  — the command palette you're extending.
- `src/components/market/QuoteRibbon.tsx` — the header ribbon.
- `src/hooks/useWatchlist.ts` — watchlist state.
- Sparkline precedent: the repo uses visx (`@visx/shape` etc.) — keep sparklines as a
  tiny inline SVG path, no charting-library ceremony.
- Palette: `carbon-*` surfaces, `silver-*` text, `brass-*` accent, `emerald-400` up /
  `rose-400` down, mono + uppercase micro-labels.

---

## Goal

The watchlist reads like a professional quote board, the command palette handles
Bloomberg-style commands, every number is typographically stable, and loading states look
deliberate.

## Tasks

### 1. Watchlist → quote board

Upgrade `MarketWatchPanel`:

- **Column header row** (uppercase micro-labels): `SYMBOL · LAST · CHG% · SPARK`. Clicking
  SYMBOL/LAST/CHG% sorts (asc → desc → manual/original order, cycling); a thin `brass-400`
  caret marks the active sort. Sorting is presentation-only — it must NOT reorder the
  persisted watchlist in localStorage.
- **Sparklines**: 30-point inline SVG of recent closes per row,
  stroked `emerald-400`/`rose-400` by net direction, ~56×16px. Data via a new hook
  `useSparklines(symbols)` that fetches `GET /api/v1/market/ohlcv/{symbol}?timeframe=1D&
count=30` per symbol through react-query (`staleTime: 5 * 60_000`, one query per symbol
  via `useQueries`, capped: skip sparkline fetches beyond the first 30 watchlist rows).
  Extract the path-building math (`closesToPath(closes, w, h)`) into
  `src/lib/market/sparkline.ts` and unit-test it.
- **Grouping by asset class** (`Instrument.assetClass`): collapsible section headers
  (stocks, futures, forex, crypto — whatever values exist in the data), collapsed state in
  component state only. Groups appear only when the watchlist has >1 distinct class.
- **Keyboard navigation**: when focus is in the watchlist (or after clicking a row), ↑/↓
  move a `brass`-ringed selection highlight, Enter selects the symbol, Delete removes it
  from the watchlist. Roving `tabIndex`, `role="listbox"`/`option`, `aria-selected`.

### 2. Command palette upgrades

Extend `SymbolCommandPalette` / `timeframeCommands.ts` with a small command grammar.
Parse the input into a typed command before falling back to plain symbol search:

- `PETR4 1H` — symbol + timeframe in one line → switch both (symbol resolved via the
  existing search; timeframe via `parseTimeframeInput` on the trailing token).
- `+PETR4` / `+ PETR4` — add to watchlist without switching the chart.
- `-PETR4` — remove from watchlist.
- Empty input → instead of the current hint text, show **recent symbols** (last 8 selected
  symbols, persisted in localStorage key `quant_recent_symbols`, updated on every symbol
  switch) as instantly selectable rows.
- Each parsed command renders as an action row at the top of the dropdown with a
  `COMMAND` chip (same style as the existing `Timeframe Action` chip). Plain queries
  behave exactly as today.

Implement the grammar as a pure function `parseCommand(input): ParsedCommand | null` in
`src/lib/market/commands.ts` — table-driven unit tests.

### 3. Typographic + status polish

- **`tabular-nums` everywhere numbers update**: add Tailwind's `tabular-nums` (and
  `slashed-zero` where it reads well) to ribbon prices, watchlist cells, and OHLC readout
  so digits don't jiggle between ticks. If a `font-variant-numeric` utility pattern
  repeats >3 times, add a tiny `@utility`/component class in the global CSS instead of
  repeating it (Tailwind v4 — check `src/index.css` conventions first).
- **▲/▼ direction glyphs** beside every change% (ribbon already has them; make watchlist
  and any chg% cells consistent — one shared `ChangeBadge` mini-component in
  `src/components/market/`).
- **Last-update timestamp**: bottom-right corner of the chart panel, `UPDATED HH:mm:ss`
  in `text-[9px] text-silver-500 font-mono`, driven by the snapshot's `tickTime`.
- **Skeleton loaders**: replace text-only loading states in the watchlist ("Loading
  assets…") and ribbon with pulsing `carbon-800` skeleton bars matching final layout
  dimensions. Keep the chart's existing `Activity` spinner — it works.
- **Density pass** on the watchlist: tighten row padding to fit ~14 rows where ~10 fit
  today, without dropping below 28px row height (click target).

### 4. Tests

- `tests/unit/lib/commands.test.ts` — table-driven `parseCommand` (every grammar form,
  garbage input → null, case-insensitivity, `+`/`-` with/without space).
- `tests/unit/lib/sparkline.test.ts` — `closesToPath` (flat series, rising, falling,
  single point, empty).
- MarketWatchPanel: sort cycling (asc/desc/original) without mutating localStorage order;
  keyboard nav (↑/↓/Enter/Delete) via `user-event`; grouping renders section headers only
  with >1 asset class.
- Command palette: `+SYM` adds to watchlist without changing selected symbol; empty input
  shows recents from a seeded localStorage.

---

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm lint` all pass. **Do not report completion
  until they do.**
- No regressions in existing market tests from WO8/WO9/WO10.
- In your final message: GIF-worthy summary of the visible changes (bullet list is fine)
  and any deviations from this spec with reasons.

## Out of scope

- `DetailZone.tsx` and its tab panels (WO10 owns them — do not touch, to avoid conflicts).
- Backend changes, new dependencies, WebSockets, market depth.
- Chart-engine changes under `src/components/charts/`.
