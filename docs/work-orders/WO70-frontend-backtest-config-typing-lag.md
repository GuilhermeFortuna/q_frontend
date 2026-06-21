# WO70 — Frontend: Backtest config typing lag (isolate the results/chart subtree)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck/build: `pnpm exec tsc -p tsconfig.app.json --noEmit` / `pnpm build`

**Context for this work:** typing into any number field on the **Backtests** page is laggy — each
keystroke stutters. The cause is a missing memo boundary, not slow inputs. All backtest form state
lives at the workspace root (`useBacktestConfig()` in `BacktestsWorkspace.tsx`), and the results pane
— which contains the heavy strategy chart — is kept mounted at all times and is **not memoized**, so it
re-renders on every keystroke and re-runs all indicator math over the full dataset (see WO71 for the
chart-internal cost). This WO **stops the unnecessary re-renders**; WO71 makes each chart render cheap.
Do **WO70 first** — it is the bigger, structural win and is independently shippable.

---

## How the pieces work today (read these files)

- `src/lib/backtesting/useBacktestConfig.ts`
  - All fields are local `useState` (`symbol`, `capital`, `pointValue`, `strategyParams`, …) and the
    hook returns a **fresh `{ fields, setters, validation, … }` object on every render** (~268–334).
- `src/workspaces/backtests/BacktestsWorkspace.tsx`
  - Calls `const backtestConfig = useBacktestConfig()` at the root (~33). A keystroke → a setter →
    this component re-renders → `backtestConfig` is a new object.
  - `equityCurve` / `monthlyStats` are `useMemo`'d on `runBacktest.data` (+`lastCapital`) (~66–74) —
    already stable across a config keystroke.
  - Renders `<BacktestFocusWorkbench config={backtestConfig} … results=… equityCurve=… monthlyStats=… />`
    (~160–174). Note: both `<OptimizeWorkflow/>` and the backtest workflow stay mounted via
    `display:none` (~134–176).
- `src/components/backtests/focus/BacktestFocusWorkbench.tsx`
  - Header comment (36–39): **"setup and results stay mounted at all times."** It renders
    `<BacktestSetupPanel config={config} … />` (form) **and** `<BacktestResultsTabs … />` (results +
    chart) as siblings (~104, ~144–152).
  - Crucially, `BacktestResultsTabs` is passed `results`, `request`, `initialCapital`, `equityCurve`,
    `monthlyStats`, `symbol`, `timeframe` — **none of which is `config`.** Those props are already
    referentially stable across a config keystroke.
- `src/components/ui/number-input.tsx` — keeps a local `draft` string (input stays responsive) but
  calls `onChange(parsed)` on **every** `handleChange` (~78–82), i.e. it commits per keystroke. That
  per-keystroke commit is fine _once the heavy subtree no longer re-renders_.

---

## Goal

Typing in a backtest config field updates only the form, not the results/chart. Establish a memo
boundary so the mounted results subtree (`BacktestResultsTabs` and the strategy chart) does **not**
re-render while editing config, because its inputs haven't changed.

```tsx
// Results subtree re-renders only when its own data changes, not on every keystroke.
const BacktestResultsTabs = memo(function BacktestResultsTabs(props) {
  /* … */
})
```

## Tasks

### 1. Memoize the results subtree

- Wrap `BacktestResultsTabs` (and, if it isn't already a clean boundary, the strategy-chart wrapper it
  renders) in `React.memo`. Confirm every prop it receives is referentially stable across a config
  keystroke: `results`, `request`/`lastRequest`, `initialCapital`, `equityCurve`, `monthlyStats`,
  `symbol`, `timeframe`. They are today (all derived from `runBacktest.data` / store, not from the
  edited field) — keep them that way; do not start threading `config` into the results pane.
- If any prop is an inline-created value (object/array/callback) at a call site, hoist it to a
  `useMemo`/`useCallback` so memo can bail out.

### 2. Keep `BacktestFocusWorkbench` from forcing the results re-render

- `BacktestFocusWorkbench` itself will still re-render on keystroke (it receives the new `config`
  object). That is acceptable **only if** its results branch is a memo boundary (Task 1). Verify the
  results `<section>` subtree bails out; the setup `<section>` may re-render (it owns the inputs).
- Do **not** change the "both panes stay mounted" invariant (focus/scroll/data preservation depends
  on it). The fix is memoization, not unmounting.

### 3. Stabilize the config object boundary for the setup panel (lighter touch)

- `BacktestSetupPanel` must re-render on keystroke (it shows the value), but it should not do extra
  work because `config` is a new object. Where it passes derived data to expensive children (e.g.
  param field lists), memoize those so only the edited field's input updates.
- Do **not** refactor `useBacktestConfig` into a store or context in this WO — keep it `useState`.
  Colocating state is a larger change; the memo boundary alone resolves the reported lag.

### 4. Apply the same boundary to the Optimize workflow if trivially parallel

- If `OptimizeWorkflow` has the identical shape (config at root + mounted results), apply the same
  `React.memo` boundary to its results pane. If it differs materially, note it and leave for a
  follow-up — do not redesign it here.

## Guardrails

> **Don't change behavior or contracts.** Same form state shape, same `buildBacktestRequest` payload,
> same run/submit flow. This WO only adds memo boundaries.

> **Keep both panes mounted.** The focus-workbench invariant (setup + results always mounted) stays.
> No unmount-on-blur, no conditional mounting of the chart.

> **No new state container.** Do not move `useBacktestConfig` into zustand/context here. Do not add
> debounce to `NumberInput`'s commit as the fix — the input is not the bottleneck.

> **Referential stability is the contract.** A memo boundary only works if props stay stable; verify
> with the test in the next section rather than assuming.

## Tests — `tests/unit/components/BacktestFocusWorkbench.test.tsx` (new) + extend `BacktestSetupPanel.test.tsx`

- Render the workbench with results present. Spy/instrument the results subtree's render count (e.g.
  a mock child or a render counter). Type into a config number field (capital/point value) and assert
  the **results subtree render count does not increase**, while the input's displayed value does.
- Assert editing a field does not change `results`/`equityCurve`/`monthlyStats` identity passed down.
- Regression: running a backtest still updates the results pane (memo does not over-block real data
  changes).

## Docs

`q_frontend/README.md` (backtests/perf note): document the memo boundary around the results pane and
the rule that the results subtree's props must stay referentially stable across config edits.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` clean.
  **Do not report completion until all pass.**
- Manually (`./dev.sh`, Backtests page, after running a sim so the chart is visible): typing rapidly
  in capital/point-value/param fields is smooth with no chart re-render (verify via React DevTools
  Profiler — the results subtree shows no commit while typing).
- Paste in the final message: which components got the memo boundary, the render-count test result
  (before/after), and confirmation the run/submit payload is unchanged.

## Out of scope

- Chart-internal cost: indicator recomputation over the full dataset on each render, and hover
  re-renders — **WO71**.
- Page-switch (view transitions) and app-wide panel paint cost — **WO72**.
- Migrating `useBacktestConfig` to a store/context — future WO if still warranted after WO70+WO71.
