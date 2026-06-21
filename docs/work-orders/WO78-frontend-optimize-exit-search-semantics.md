# WO78 — Frontend: correct Optimization exit semantics — selected exits are search _candidates_, not forced-on

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`

**Context for this work:** WO76 added exit toggle cards to the Optimization setup, but with the
**wrong search semantic**: it pins every selected exit **on in every trial** (`enable_param` fixed to
its on-value), so all selected exits are always applied together. The user wants a selected exit to be
a **candidate in the search** — the optimizer must explore turning each candidate **on or off
independently**, testing the entry strategy with **each exit alone, any combination, and entry-only**
— never forcing them all on.

This is **Optimization only** and **frontend only**. **No backend change** — the Optuna sampler
(`q_backend/.../optimization/search_space.py::_suggest_param`) already handles int/float/categorical,
including a range that spans `0..max` with a step (so `0` = "off" is a sampled grid point). Simulation
(WO77) is **unaffected** — a single run applies its toggled exits concretely; there is no search.

Read the design doc first: `q_frontend/docs/design/exit-strategy-cards.md` — section **"Correction —
Optimization exit search semantics (WO78)"**.

---

## How the pieces work today (read these files)

- `src/lib/optimize/exitSearchSpace.ts` — the WO76 payload logic to fix:
  - `pinEnableParamSearchParam(rule, enabled, …)` pins `enable_param` to a fixed value (on-value when
    `enabled`, else `0`) — a degenerate `low===high` range.
  - `buildEnabledExitParamSpecs(...)` collects **tunable** specs via `getTunableRuleParamSpecs`
    (which **excludes** `enable_param`).
  - `buildStrategyParamsSearchSpacePayload(...)` = entry specs + enabled tunable specs → ranges, then
    pins every applicable rule's `enable_param` (on for enabled, `0` for disabled). **This forces
    enabled exits on — the bug.**
- `src/lib/optimize/useOptimizeConfig.ts` — `enabledExitRuleIds: Set<string>`, `toggleExitRule`,
  `applicableExitRules`, `enabledExitParamSpecs`, and `buildOptimizationConfigPayload` which calls
  `buildStrategyParamsSearchSpacePayload`. `defaultSearchSpaceFromSpecs` seeds each param's range from
  `spec.min`/`spec.max` + a step.
- `src/components/optimize/setup/OptimizeStrategyDetailPanel.tsx` — renders
  `StrategySearchSpaceFields` for entry + enabled-exit specs.
- `src/components/optimize/setup/OptimizeSetupPanel.tsx` — wires `ExitStrategyCards`.
- `src/lib/strategies/strategyParams.ts` — `searchSpaceToPayload`, `defaultSearchSpaceFromSpecs`,
  `SearchSpaceFieldState`.
- `src/workspaces/strategy/exitRuleSemantics.ts` — `resolveRuleParamSpecs` (all `param_names`),
  `getVisibleSharedParamNames`, `defaultEnableValue`.
- Tests: `tests/unit/lib/optimize/exitSearchSpace.test.ts`,
  `tests/unit/lib/optimize/useOptimizeConfig.custom.test.ts`,
  `tests/unit/components/OptimizeCustomStrategies.test.tsx`.

> **Terminology:** rename the optimize-side concept from "enabled" to **candidate** to avoid
> confusion (it no longer means "on"). Suggested: `candidateExitRuleIds`, `toggleExitRule` (keep),
> `candidateExitParamSpecs`. Update `useOptimizeConfig` exports + the two consumers
> (`OptimizeSetupPanel`, `OptimizeStrategyDetailPanel`). Simulation's `StrategyStudio` is untouched.

---

## Goal

Selecting exits in Optimization adds them to the **search**; the optimizer decides which to use:

```
candidate: ATR Stop, Take Profit          (entry: MA Crossover)
trials explore →  entry only
                  entry + ATR Stop (various magnitudes)
                  entry + Take Profit (various magnitudes)
                  entry + ATR Stop + Take Profit
non-candidate exits → pinned off (never applied)
```

## Tasks

### 1. Candidate exits sweep (incl. their enable/magnitude), don't pin on

Rewrite `buildStrategyParamsSearchSpacePayload` so that, for each **candidate** rule, **all** of its
`param_names` (via `resolveRuleParamSpecs(rule, exitParamSpecs)` — **including `enable_param`**) are
emitted as **swept ranges** from `strategySearchSpace`, plus the shared params it requires. Then:

- **Force the candidate `enable_param` range to include `0`:** when emitting it, set `low = 0`
  (keep `high`/`step`/type from the seeded range). The step must be present so `0` is a real grid
  point (`defaultSearchSpaceFromSpecs` already adds one; default it if missing). This is what lets the
  optimizer turn the exit **off** in some trials.
- **Non-candidate applicable rule:** pin `enable_param` fixed `0` (the existing
  `pinEnableParamSearchParam(rule, false, …)`).
- **Entry params:** ranges, unchanged.
- Remove the `pinEnableParamSearchParam(rule, true, …)` (on-pin) path — candidates are swept, never
  pinned on.

### 2. Right panel shows the candidate's full range (incl. magnitude/enable)

`buildEnabledExitParamSpecs` → `buildCandidateExitParamSpecs`: include the `enable_param`/magnitude
spec (use `resolveRuleParamSpecs`, **not** `getTunableRuleParamSpecs`) so the detail panel shows a
range field for it. The user can widen/narrow the magnitude; its `low` is shown/forced to `0`.
`getTunableRuleParamSpecs` may be deleted if now unused.

### 3. Card copy reflects "search candidate"

In the Optimization exit cards (heading/sublabel only — `ExitStrategyCards` stays generic via its
`heading` prop), convey that a checked exit is **explored on/off**, e.g. heading
`"Exit Strategies — searched (on/off)"` or a one-line helper under it. Do **not** add optimize logic
into the shared `ExitStrategyCards` component.

### 4. Keep selection state + defaults

Keep `candidateExitRuleIds` initialized from rules whose `enable_param` default `> 0` (so today's
default exits are searched out of the box); `toggleExitRule` flips membership. No change to the
applicable-rule filter.

## Guardrails

> **Candidate ≠ forced on.** A candidate's `enable_param` MUST appear as a **range with `low === 0`**
> (and a step so `0` is a grid point) — NOT a fixed `low===high` pin. Assert this in a test.

> **Non-candidate = pinned off.** Every applicable non-candidate rule's `enable_param` is pinned
> fixed `0`. Assert it.

> **Independent per exit.** Two candidates ⇒ two independent enable ranges (both `low 0`), so the
> optimizer can explore any subset (each alone, both, neither). Assert with 2 candidates.

> **No backend change.** Ranges with `low=0..high` + step are already sampled by `_suggest_param`; a
> trial that samples `enable_param=0` disables that rule and its other sampled params are ignored by
> the strategy. Do not touch `q_backend`.

> **Optimization only.** Do not modify `StrategyStudio` / Simulation behavior. `ExitStrategyCards`
> stays generic (no optimize-specific logic inside it).

> **Custom strategies keep working** (selectedStrategy is custom-resolved). Cover in a test.

## Tests — `tests/unit/lib/optimize/` (rewrite the WO76 expectations)

- `exitSearchSpace`: a candidate exit → its `enable_param` is a **range** `{ low: 0, high: …, step }`
  (NOT `low===high`), and its other `param_names` are present as ranges; a non-candidate applicable
  exit → `enable_param` pinned `{low:0,high:0}`; entry params present.
- Two candidates → both enable params are ranges with `low 0` (independent on/off).
- Magnitude-as-enable exit (e.g. `take_profit_pct`) → single range field with `low 0` (off ↔
  magnitude in one dimension); no separate pin.
- Custom strategy → same behavior.
- Update `useOptimizeConfig.custom` / `OptimizeCustomStrategies` tests for the renamed
  candidate API and the new payload shape.

## Docs

`q_frontend/docs/design/exit-strategy-cards.md` already carries the corrected semantics (WO78
section) — keep it the source of truth; update only if you diverge.

---

## Definition of done

- `pnpm test:run` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` are clean.
  **Do not report completion until all three pass.**
- Manually (`./dev.sh`, Backtests → Optimization): select two exits, start a study, and confirm trials
  vary which exits are active (not all-on every trial) — e.g. inspect the emitted `search_space`
  payload: candidate enable params are ranges starting at `0`, non-candidates pinned `0`.
- Paste in the final message: the corrected `buildStrategyParamsSearchSpacePayload` behavior
  (candidate enable param = range `low 0`, non-candidate = pinned 0), the renamed candidate API, and
  a sample `strategy_params` payload for one entry + two candidate exits.

## Out of scope

- Simulation `StrategyStudio` — unchanged (WO77).
- Backend / Optuna changes.
- Letting **Discovery** (genetic search) evolve/search the composable risk exits — Discovery uses its
  own DSL exit nodes and does not touch the exit-rule catalog; that's a separate future feature, not
  this WO.
