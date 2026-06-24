# WO111 — Frontend: multi-entry instances + manager in Simulation (StrategyStudio)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.
- (`pnpm test` is watch mode — use `pnpm test:run`.)

Read `docs/design/multi-entry-composition.md` (**Architecture → Frontend**). Depends on **WO109**
(backend `entries`/`entry_manager`/`exit_params` payload + `/api/v1/signal-managers`). Mirrors the
card model from **WO88** (entries/exits are first-class `LibraryCard`s).

## How the pieces work today (read these files)

- `src/components/backtests/setup/StrategyStudio.tsx` — Simulation setup. Left column =
  `StrategyLibrary` (single-select entry) + `ExitStrategyCards` (multi-select exits); right column
  stacks the selected entry's `entryParamSpecs` then each enabled exit's params.
- `src/components/backtests/setup/StrategyLibrary.tsx` + `LibraryCard.tsx` — the card grid + shared
  card shell (from WO88). Entry cards are currently **single-select** (`onSelectBuiltIn`).
- `src/lib/backtesting/useBacktestConfig.ts` — config hook. Holds `strategy`,
  `strategyParams`; `handleStrategyChange`, `handleParamChange`; `selectedStrategy`,
  `entryParamSpecs`/`exitParamSpecs` (via `partitionStrategyParamSpecs`); `buildBacktestRequest`
  (builds `BacktestRequest`).
- `src/types/backtesting.ts` — `BacktestRequest` type. `src/types/strategies.ts` — strategy/exit
  catalog types.
- `src/api/queries/strategies.ts` — catalog queries (add a signal-managers query here).

## Goal

Pick **several** entry strategies (duplicates allowed), choose how they combine, and tune each
instance's params — exits unchanged.

```
LEFT COLUMN                           RIGHT DETAIL PANEL
┌ Entry Strategies  (multi-select)   ┌ Manager: ( OR ) ( AND ) (Majority ▸ vote 2)
│ [MA Crossover●] [RSI●] [Donchian]  │  ── e0 · MA Crossover ──   short… long…
│  TREND          MEAN-REV  BREAKOUT │  ── e1 · RSI ──            rsi_period…
│  + Add another MA Crossover        │  ── Exit: ATR Stop ──      atr_mult…
│ ───────────────────────────        │  ── Exit: Take Profit ──  take_profit_pct…
│ Exit Strategies (cards, WO88)      └
└
  ● = selected instance. Same strategy can be added twice (distinct instances).
```

## Tasks

### 1. Config hook — `useBacktestConfig.ts`

- Add state `entries: EntryInstanceState[]` where `EntryInstanceState = { slotId: string;
strategy: string; params: Record<string, StrategyParamValue> }`, and `entryManager:
{ kind: 'or'|'and'|'majority'; params: Record<string, unknown> }` (default `{kind:'or'}`).
- Keep exits in their own bag `exitParams` (split from the old `strategyParams` exit portion) — or
  keep `strategyParams` for exits only and move entry params into per-instance `params`. Pick one
  and document; **exits stay one shared set**.
- Actions: `addEntry(strategyName)` (pushes a new instance with default params from the catalog,
  unique `slotId`), `removeEntry(slotId)`, `handleEntryParamChange(slotId, name, value)`,
  `setEntryManager(...)`. Reuse `partitionStrategyParamSpecs` per instance for its entry specs.
- `buildBacktestRequest`: emit `entries` (`[{strategy, params}]`), `entry_manager`, and
  `exit_params`. **Back-compat shortcut:** if exactly one instance and `kind==='or'`, you may also
  set the legacy `strategy`/`strategy_params` so nothing downstream breaks — but the new fields are
  the source of truth (WO109 normalizes either way).
- Hydration (`loadCustom`/pending config): accept either legacy single `strategy` or an `entries`
  array.

### 2. Manager selector — new `src/components/backtests/setup/EntryManagerSelector.tsx`

- Fetch managers from `/api/v1/signal-managers` (new query in `api/queries/strategies.ts`).
- Render a segmented control (OR / AND / Majority). When `majority`, render its `vote_threshold`
  param via the existing `StrategyParamFields` (min 1, max = number of instances).
- Props: `{ managers, value, onChange, instanceCount }`.

### 3. Multi-select entry cards — `StrategyStudio.tsx` + `StrategyLibrary.tsx`

- Make the entry grid **multi-select / additive**: clicking a card `addEntry(name)`; a small
  "Add another" affordance allows duplicate instances of the same strategy. Show a selected/active
  state per card when ≥1 instance of it exists (and a count badge if >1). Keep custom strategies
  working (they're just another entry strategy name).
- Reuse `LibraryCard` (presentational) — do not fork the visual shell.

### 4. Right panel — per-instance params + manager + exits

- Top: `<EntryManagerSelector/>`.
- Then one section per entry instance (label `e{i} · <strategy label>`, with a remove button),
  each rendering that instance's entry `StrategyParamFields` bound to
  `handleEntryParamChange(slotId, …)`.
- Then the existing enabled-exit param sections (unchanged).

## Guardrails

> Reuse `LibraryCard`, `StrategyParamFields`, `partitionStrategyParamSpecs`, and the exit-card
> wiring — no re-implementation. Visual shell stays identical to WO88 cards.
> **Exits stay one shared set** across all instances (position-level). Do not duplicate exit config
> per instance.
> A single-instance + OR setup must produce a request equivalent to today's payload (assert in a
> test) so existing runs are unaffected.
> Manager catalog is fetched (not hard-coded) so future managers appear without a frontend change.

## Tests

- `useBacktestConfig` test: `addEntry` twice with the same strategy creates two instances with
  independent params; `handleEntryParamChange` edits only the targeted slot; `removeEntry` drops it.
- `buildBacktestRequest` test: 2 instances + majority(2) emits the expected `entries`/`entry_manager`
  /`exit_params`; single instance + OR emits a back-compatible payload.
- `EntryManagerSelector` test: switching to Majority reveals `vote_threshold`, clamped to instance
  count.
- `StrategyStudio` test: selecting two entry cards renders two per-instance param sections on the
  right plus the manager selector; exit cards still toggle their own param sections.

## Docs

- `docs/design/exit-strategy-cards.md` / `multi-entry-composition.md`: note entries are now
  multi-select instances paired with a manager (cross-link).

## Definition of done

- `pnpm test:run`, `pnpm exec tsc -p tsconfig.app.json --noEmit`, and `pnpm build` all pass —
  **do not report completion until they do.**
- Paste-in-final-message: confirm (a) duplicate instances of one strategy work, (b) the manager
  selector drives `entry_manager`, (c) a single-entry+OR setup yields a back-compatible payload.

## Out of scope

- Optimize setup multi-entry — **WO112**.
- New manager types beyond OR/AND/Majority.
