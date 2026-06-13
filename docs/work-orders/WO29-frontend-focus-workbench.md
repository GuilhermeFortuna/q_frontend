# WO29 — Frontend: reversible focus-swap between setup and results panes

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck/lint: `pnpm lint` (check `package.json` for exact names)

**Context for this work:** this batch ("Backtest Workbench") redesigned the Backtests page.
WO28 made the setup experience (strategy library + detail panel + config band) fill the
canvas when no run exists, and left setup and results as **sibling panes** of
`BacktestsWorkspace`, with a dumb summary strip + "Edit setup" button toggling between
them. This work order replaces that hard toggle with the design's core interaction: setup
and results are two views of one workbench, **whichever the user engages gets the stage,
and the other collapses to a live, clickable teaser** — never dead chrome, never hidden.
Click the collapsed setup teaser → it slides back to take most of the space (results
shrink to their teaser). Click the collapsed results teaser → results take over again.
Fully reversible, any number of times, with state preserved on both sides.

---

## How the frontend works today (read these files)

- `src/workspaces/backtests/BacktestsWorkspace.tsx` — post-WO28 host: setup pane
  (`BacktestSetupPanel`), results pane (`BacktestResultsTabs` + Results/History tabs),
  the summary strip you are replacing, and the run mutation state.
- `src/components/backtests/setup/` — WO28's setup components. The collapsed-setup teaser
  summarizes state owned by `useBacktestConfig`
  (`src/lib/backtesting/useBacktestConfig.ts`).
- `src/components/backtests/BacktestMetricsBar.tsx` and
  `src/lib/backtesting/performance.ts` — metric names/formatters for the collapsed-results
  teaser; `buildEquityCurve` (already computed in the workspace) feeds its sparkline.
- `src/components/backtests/EquityCurveChart.tsx` — see what charting primitive it wraps;
  the sparkline should be a trivial use of the same primitive or plain SVG, not a new dep.
- `src/styles/globals.css` — design tokens and any existing transition/animation
  conventions.

---

## Goal

One workbench, two panes, one `focus`. The focused pane gets ~the full canvas; the
unfocused pane collapses to a compact strip that **shows live information and acts as the
button that restores it**. Transitions are smooth slides, reversible without limit, and
nothing (form state, results, history selection, scroll within results) is lost when a
pane collapses.

## Tasks

### 1. Focus model

- `focus: 'setup' | 'results'` in `BacktestsWorkspace` (or its store slice if one exists —
  match the codebase). Initial: `'setup'`. On run submit → `'results'` immediately (the
  pane shows the existing spinner state, so the user watches the run land where the
  results will be). History/compare interactions stay inside the results pane and don't
  fight the focus model.
- Both panes stay **mounted** at all times — collapse is a layout state, not an unmount
  (this is what preserves form inputs, fetched results, and tab selection for free).

### 2. Collapsed teasers (the heart of this WO)

- **Collapsed setup** (focus = results): a slim strip — strategy label + a short params
  digest (e.g. "MA crossover · 50/200"), symbol · timeframe · range · capital, and a
  **Run button that works from the collapsed state** (re-run with current config without
  expanding — the fast iteration loop must not cost an extra click). Clicking anywhere
  else on the strip swaps focus to setup.
- **Collapsed results** (focus = setup):
  - With a completed run: 3–4 headline metrics (net profit, win rate, max drawdown,
    trades — reuse `BacktestMetricsBar` formatters) + a small equity sparkline. Clicking
    swaps focus to results.
  - Run in flight: compact progress/spinner state ("Simulating…").
  - No run yet: a quiet strip giving access to **History** (history must remain reachable
    pre-run; clicking focuses the results pane on its History tab).
- Teasers update live: tweak a param while results are focused → the setup strip digest
  reflects it; a new run completes → the results teaser metrics/sparkline refresh.
- Decide strip orientation (top/bottom bars vs side rails) by what reads best with WO28's
  layout — but both collapsed states must use the **same** orientation so the swap reads
  as one object sliding, not two unrelated layouts.

### 3. Transition

- Animate the pane swap as a slide (CSS transition on grid template / flex-basis /
  transform — pick what stays 60fps with the charts mounted; avoid animating properties
  that force chart reflow every frame, or gate chart resize to the transition's end).
- ~250–350ms, both directions. Honor `prefers-reduced-motion: reduce` → instant swap.

### 4. Accessibility & semantics

- Each collapsed strip is a real `<button>` (or has `role="button"` + keyboard handling):
  Enter/Space swaps focus; visible focus ring per the design tokens; `aria-expanded` on
  each pane's control; the embedded Run button on the setup strip stops propagation so it
  runs without swapping.
- Document (one comment in the workspace) the focus invariant: exactly one pane focused,
  both always mounted.

### 5. Tests

- Submit → focus lands on results; completed metrics appear in flow.
- Click collapsed setup strip → setup expands, **form state intact**; click collapsed
  results teaser → results return, **same results object, no refetch** (assert the query/
  mutation was not re-fired).
- Run button on the collapsed setup strip fires a new run **without** changing focus to
  setup.
- Pre-run collapsed results strip routes to the History tab.
- Param change while collapsed updates the setup strip digest.
- Reduced-motion path renders both states (no assertion on animation itself).

---

## Definition of done

- `pnpm test:run` and the lint/typecheck scripts pass. **Do not report completion until
  they do.**
- Manual check against the dev backend: run → swap to setup → tweak a param → re-run from
  the collapsed strip → swap freely during and after the run; nothing resets, nothing
  jumps. Charts render correctly at both pane widths (resize handling).
- WO28's "Edit setup" summary strip is fully replaced — no dead code left.
- In your final message: state where `focus` lives, the strip orientation you chose and
  why, and any chart-resize workaround you needed.

## Out of scope

- Any backend change.
- Drag-to-resize between the panes (focus swap is binary by design; revisit only if usage
  demands it).
- Applying the focus-swap pattern to the Optimize or Validate workspaces (candidates for
  a later WO once this one proves the pattern).
- Persisting focus state across app restarts.
