# WO8 — Frontend: live watchlist quotes, real formatting, MT5 status

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Lint: `pnpm lint`
  - Unit tests use Vitest + Testing Library + **MSW** (`src/mocks/handlers.ts`,
    `src/mocks/data.ts`). Any new endpoint you consume MUST get an MSW handler + mock data.

**Context for this work:** the Market page (`src/workspaces/market-data/MarketDataWorkspace.tsx`)
is being upgraded into a Bloomberg-style terminal. WO7 (backend, already specified) ships:

- Enriched `GET /api/v1/market/snapshot/{symbol}` — adds `bid`, `ask`, `spread`,
  `changeAbs`, `dayOpen`, `dayHigh`, `dayLow`, `prevClose`, `digits`, `tickTime` to the
  existing `{symbol, last, changePct, volume}`.
- Batch `GET /api/v1/market/snapshots?symbols=A,B,C` → `{"snapshots": [...]}` (same shape,
  unresolvable symbols silently skipped, 503 when MT5 offline).

Build against the WO7 contract (exact field names above). If WO7's completion message
included final JSON examples, prefer those. This work order is **frontend only.**

---

## How the Market page works today (read these files)

- `src/workspaces/market-data/MarketDataWorkspace.tsx` — the whole page (~820 lines).
  - `mockPrices` (~line 88): a hardcoded `Record<string, {last, changePct}>` used to fake
    watchlist prices. Symbols not in it render `50.00`. **You will delete this.**
  - `formatPrice` (~line 25): guesses decimal places from the symbol name. **You will
    replace its call sites with digits-aware formatting.**
  - Watchlist state is local + `localStorage` (`quant_watchlist`), seeded from
    `useInstruments()`. Keep this mechanism.
- `src/api/queries/market-data.ts` — query hooks (`useInstruments`, `useMarketSnapshot`,
  `useSearchSymbols`, query-key factory `marketDataKeys`). Add new hooks here, follow the
  existing key-factory pattern.
- `src/types/api.ts` — `MarketSnapshot` type (~line 40). Extend it per WO7.
- `src/mocks/handlers.ts` + `src/mocks/data.ts` — MSW handlers for
  `*/api/v1/market/instruments`, `*/api/v1/market/snapshot/:symbol`, etc.
- Styling: Tailwind v4 with project palette classes (`carbon-*`, `silver-*`, `brass-*`,
  `emerald-400` for up, `rose-400` for down). Match existing class usage exactly.

---

## Goal

Every price on the Market page is real and ticks. The fake `mockPrices` table is gone, the
watchlist polls the batch endpoint, prices flash on change, decimals come from MT5
`digits`, and MT5-offline is a visible status instead of a broken page.

## Tasks

### 1. Types + queries

- Extend `MarketSnapshot` in `src/types/api.ts` with the WO7 fields (all the new ones
  optional-safe if you must, but prefer required since WO7 always returns them).
- New hook in `src/api/queries/market-data.ts`:

```ts
useMarketSnapshots(symbols: string[]) // GET /api/v1/market/snapshots?symbols=...
```

- `refetchInterval: 3_000`, `staleTime: 2_000`, enabled only when `symbols.length > 0`.
- Key it via `marketDataKeys` (add a `snapshots(symbols)` entry; sort+join symbols in the
  key so order doesn't bust the cache).
- Returns a `Record<string, MarketSnapshot>` keyed by symbol (use `select`) so consumers
  do O(1) lookups.

- Give the existing `useMarketSnapshot(symbol)` a `refetchInterval: 2_000` so the header
  ribbon ticks too.

### 2. Kill `mockPrices` — wire the watchlist to real quotes

In `MarketDataWorkspace.tsx`:

- Call `useMarketSnapshots(watchlist.map((w) => w.symbol))`.
- Watchlist rows render `last` and `changePct` from the batch result. Delete `mockPrices`
  and the `?? 50.0` fallbacks entirely.
- A symbol with no snapshot yet (loading, or skipped by the backend) renders `—` em-dashes,
  not a fake number.
- Add `bid`/`ask` as a smaller second line or right-aligned sub-row in each watchlist row
  — match the existing row layout/typography (font-mono, `text-[10px]` secondary text).

### 3. Price-flash animation

When a watchlist row's `last` changes, flash the price cell background: brief
emerald-tinted pulse on uptick, rose-tinted on downtick, decaying over ~600ms.

- Implement as a small reusable component or hook (e.g.
  `src/components/shared/FlashOnChange.tsx` or `usePriceFlash(value)`) — WO10/WO11 will
  reuse it for the tape and quote panel.
- Use a CSS transition/animation keyed off a direction state; do NOT pull in a new
  animation dependency (`motion` is already available if needed, but plain CSS is fine).
- The flash must not re-trigger on unrelated re-renders — only on actual value change
  (compare previous value via a ref).

### 4. Digits-aware price formatting

- Add `formatPrice(value, digits)` to a shared util (e.g. `src/lib/market/format.ts`):
  `toLocaleString` with `minimumFractionDigits = maximumFractionDigits = digits`.
- Use `snapshot.digits` everywhere a price renders on this page (header ribbon, watchlist,
  search results don't show prices so they're unaffected). Fall back to 2 when no snapshot
  exists yet.
- Delete the old heuristic `formatPrice` in `MarketDataWorkspace.tsx`. The OHLC ribbon
  (bar open/high/low/close) uses the selected symbol's `digits` from its snapshot.

### 5. MT5 connection status

The batch and single snapshot endpoints return **503 when the MT5 terminal is offline**.

- Surface this as a status pill in the page header (e.g. next to the symbol name): a small
  dot + label — `LIVE` (emerald) when snapshots succeed, `MT5 OFFLINE` (rose) when the
  latest snapshot query failed with 503, `CONNECTING…` (silver, pulsing) while loading.
- When offline, the watchlist keeps showing the last known prices (react-query cache does
  this for free — just don't blank the rows on error) with the status pill communicating
  staleness.

> **GUARDRAIL — no error walls.** A 503 must never replace the page or the chart with an
> error screen. The chart renders historical data regardless; only the status pill and
> (gracefully stale) quotes reflect the outage.

### 6. MSW mocks + tests

- `src/mocks/handlers.ts`: add `*/api/v1/market/snapshots` handler returning enriched
  snapshots for the symbols requested (build from a `mockSnapshots` map in
  `src/mocks/data.ts`; enrich the existing per-symbol mock data with the new WO7 fields).
- Update the existing `*/api/v1/market/snapshot/:symbol` mock to the enriched shape.
- Unit tests (follow the style of `tests/unit/api/*.test.ts` and
  `tests/unit/components/*.test.tsx`):
  - `useMarketSnapshots` returns a record keyed by symbol; empty symbol list disables the
    query.
  - Watchlist renders real mock prices and em-dashes for symbols missing from the batch.
  - `formatPrice(1234.5, 0)` → `"1,235"`-style assertions (locale-stable: assert via
    `toLocaleString` expectations, not hardcoded separators).
  - Flash hook/component: value change sets direction state; no flash on equal value.

---

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm lint` all pass. **Do not report completion
  until they do.**
- `mockPrices` no longer exists anywhere in the codebase (`grep` for it).
- In your final message, list the new/changed exports of `src/api/queries/market-data.ts`
  and the final `MarketSnapshot` type — WO10/WO11 build against them.

## Out of scope

- Splitting `MarketDataWorkspace.tsx` into components (WO9 does the refactor — keep your
  changes surgical so WO9 rebases cleanly).
- Time & sales, quote panel, instrument info panel (WO10).
- Watchlist sorting/sparklines/keyboard nav (WO11).
- Any backend change. WebSockets.
- New dependencies.
