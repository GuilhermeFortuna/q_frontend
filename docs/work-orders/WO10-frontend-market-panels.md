# WO10 — Frontend: quote panel, time & sales tape, instrument info

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Lint: `pnpm lint`
  - Unit tests use Vitest + Testing Library + **MSW** (`src/mocks/handlers.ts`,
    `src/mocks/data.ts`). Any new endpoint you consume MUST get an MSW handler + mock data.

**Context for this work:** the Market page is being upgraded into a Bloomberg-style
terminal. Prerequisites already merged:

- **WO7 (backend)** ships `GET /api/v1/market/ticks/{symbol}?limit=N` →
  `{"ticks": [{timestamp, bid, ask, last, volume, side: "buy"|"sell"|null}]}` (newest
  last) and `GET /api/v1/market/instrument-info/{symbol}` →
  `{symbol, description, exchange, currencyBase, currencyProfit, digits, point, tickSize,
tickValue, contractSize, volumeMin, volumeMax, volumeStep, spreadFloating}`. The
  enriched `MarketSnapshot` (bid/ask/spread/dayHigh/dayLow/prevClose/digits/…) is already
  typed in `src/types/api.ts` and polled via hooks in `src/api/queries/market-data.ts`.
- **WO8 (frontend)** shipped `useMarketSnapshots`, a price-flash helper (look in
  `src/components/shared/` or `src/hooks/` for the flash component/hook — REUSE it), and
  digits-aware `formatPrice(value, digits)` in `src/lib/market/format.ts`.
- **WO9 (frontend)** decomposed the page into `src/components/market/` and added a
  resizable layout whose right **DetailZone** (`src/components/market/DetailZone.tsx`) has
  three placeholder tabs: `QUOTE` · `TAPE` · `INFO`. **You fill those three tabs.**

Verify those files exist before starting; if a named export differs slightly, adapt to
what's there rather than re-implementing. This work order is **frontend only.**

---

## Read these files first

- `src/components/market/DetailZone.tsx` — the tab shell you're filling.
- `src/api/queries/market-data.ts` — hook patterns + `marketDataKeys` factory.
- `src/lib/market/format.ts` — `formatPrice(value, digits)`.
- `src/components/market/MarketWatchPanel.tsx` — reference for row styling/density.
- Project palette: `carbon-*` surfaces, `silver-*` text, `brass-*` accent, `emerald-400`
  up / `rose-400` down, `font-mono` + `text-[10px]`/`text-xs` for data, uppercase
  tracking-wider micro-labels.

---

## Goal

The DetailZone's three tabs become real: a Bloomberg-style quote panel, a live time &
sales tape, and a contract-specs panel — all for the currently selected symbol, all
degrading gracefully when MT5 is offline.

## Tasks

### 1. Queries

Add to `src/api/queries/market-data.ts` (follow existing patterns + key factory):

- `useRecentTicks(symbol, { enabled })` — `GET /api/v1/market/ticks/{symbol}?limit=200`,
  `refetchInterval: 2_000`. Pass `enabled: false` when the TAPE tab is not active —
  **do not poll a hidden tab.**
- `useInstrumentInfo(symbol)` — `GET /api/v1/market/instrument-info/{symbol}`,
  `staleTime: 5 * 60_000` (contract specs barely change). Fetch only when INFO tab active.

Add `Tick` and `InstrumentInfo` types to `src/types/api.ts` per the WO7 contract.

### 2. QUOTE tab — `src/components/market/QuotePanel.tsx`

Data: the selected symbol's `MarketSnapshot` (already polled by the workspace — take it
as a prop; do not start a duplicate poll).

Layout, top to bottom (dense, mono, right-aligned numbers):

1. **Last price** — large (`text-2xl`), flash-on-change (reuse the WO8 flash helper),
   with `changeAbs` and `changePct` beneath, colored by sign with ▲/▼.
2. **Bid × Ask** — two columns with the spread centered between them in
   `text-silver-400`; bid in `rose-400`, ask in `emerald-400`.
3. **Day range bar** — horizontal track (`carbon-700`) from `dayLow` to `dayHigh` with a
   `brass-400` marker dot at `last`, labels at both ends. Handle the degenerate
   `dayHigh === dayLow` case (center the dot).
4. **Stats grid** — two-column label/value rows: Open, Prev Close, Day High, Day Low,
   Volume, Last Update (`tickTime`, formatted `HH:mm:ss` via `date-fns`).

All prices via `formatPrice(value, snapshot.digits)`. Missing snapshot → skeleton rows
(pulsing `carbon-800` bars), not zeros.

### 3. TAPE tab — `src/components/market/TimeAndSalesPanel.tsx`

- Table-like scrolling list, newest tick **on top** (reverse the API order), columns:
  time (`HH:mm:ss`), price (`last`), size (`volume`).
- Row coloring: `side === "buy"` → price in `emerald-400`; `"sell"` → `rose-400`; `null`
  → fall back to uptick/downtick vs the previous tick's price, neutral `silver-300` when
  equal.
- Cap rendered rows at 200. Use `@tanstack/react-virtual` (already a dependency) ONLY if
  plain rendering of 200 rows shows jank — otherwise keep it simple.
- New ticks arriving via poll should not yank the scroll position when the user has
  scrolled down: track "stick to top" (auto-stick when scrolled to top, pause when not),
  with a small `↑ N new` pill to jump back.
- Header row with column labels in the uppercase micro-label style. Empty state: `No
trades in feed.` Quote-only feeds (FX, `last === 0`) display bid as the price.

### 4. INFO tab — `src/components/market/InstrumentInfoPanel.tsx`

- Definition-list of contract specs from `useInstrumentInfo`: Description, Exchange,
  Currency (base/profit), Digits, Point, Tick Size, Tick Value, Contract Size, Volume
  Min/Max/Step, Spread type (Floating/Fixed).
- Format numbers with appropriate precision (`tickValue` etc. can be fractional — show as
  given, trimmed of trailing zeros; do NOT force `digits` here, these aren't prices).
- 404 (symbol has no info) → quiet empty state; loading → skeleton rows.

### 5. Wire into DetailZone

- Replace the three placeholders. The right panel should now **default to expanded** with
  the QUOTE tab active (flip the WO9 collapsed-by-default choice).
- Tab activity gates polling (task 1). Switching symbols while on any tab refetches for
  the new symbol (this falls out of query keys — verify, don't hand-roll).

### 6. MSW mocks + tests

- Handlers for `*/api/v1/market/ticks/:symbol` (deterministic generated tick list in
  `src/mocks/data.ts` — include buy, sell, and null-side ticks) and
  `*/api/v1/market/instrument-info/:symbol`.
- Tests (style of `tests/unit/components/*.test.tsx`):
  - QuotePanel: renders all stats from a mock snapshot; skeletons without one; day-range
    marker position math (export the position helper and unit-test it, including the
    degenerate range).
  - TimeAndSalesPanel: newest-first ordering; side coloring incl. uptick/downtick
    fallback; `↑ N new` pill behavior can be covered by testing the stick-to-top state
    hook if extracted.
  - InstrumentInfoPanel: field rendering; empty state on 404.
  - Queries: `useRecentTicks` disabled when `enabled: false`.

---

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm lint` all pass. **Do not report completion
  until they do.**
- With the dev backend offline (MSW only — `pnpm dev`), all three tabs render mock data
  without console errors.
- In your final message, list new files, new exports of `market-data.ts`, and any WO7
  contract mismatches you had to adapt to.

## Out of scope

- Market depth / order book (no backend for it yet).
- Watchlist/board upgrades, command palette, ribbon polish (WO11).
- Any backend change. New dependencies. WebSockets.
