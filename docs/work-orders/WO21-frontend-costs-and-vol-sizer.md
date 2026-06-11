# WO21 — Frontend: transaction-cost fields + inverse-volatility sizer forms

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use
  npm. Tests: `pnpm test:run`.

**Context for this work:** the backend just gained two additive config surfaces in the
"Academic Strategy Library" batch: a per-run **transaction cost model**
(WO18 — `BacktestRequest.costs: {cost_per_contract, cost_bps}`, both per side, defaults 0)
and a third **position-sizing mode** (WO20 — `position_sizing.type:
"inverse_volatility"` with `target_volatility_pct`, `min_contracts`, `max_contracts`).
This WO surfaces both in the backtest and optimizer config forms. The new strategies
themselves (WO19/WO20) need **no** frontend work — strategy param forms are
schema-driven off `GET /api/v1/strategies`.

**Build against the contracts pasted in WO18's and WO20's completion messages.** If a
field name below disagrees with those messages, the completion messages win.

---

## Where the existing config flows (read these files)

- `src/lib/backtesting/positionSizing.ts` — position-sizing types/helpers; the
  `fixed_quantity` / `fixed_safety_margin` discriminated union lives here. **Extend the
  union with `inverse_volatility`** following the existing pattern.
- `src/types/backtesting.ts` — request/response types; add `costs` to the backtest
  request type.
- `src/components/backtests/BacktestConfigForm.tsx` — the single-run form. Find how the
  position-sizing mode selector + per-mode fields render; add the third mode and a small
  "Transaction costs" field group (two numeric inputs, default 0, with per-side helper
  text).
- `src/components/optimize/OptimizeRiskSection.tsx` and
  `src/components/optimize/optimizeFormShared.tsx` — the optimizer's risk/sizing form;
  mirror the same additions so studies can run with costs and the new sizer.
- `src/lib/optimization/bridge.ts` and `src/lib/optimize/hydrateConfigForm.ts` — config
  serialization to the API and rehydration from persisted run/study configs. A run saved
  with `costs` or the new sizer must round-trip back into the form
  (see `tests/unit/lib/hydrateConfigForm.test.ts` for the existing pattern).
- `src/lib/reports/backtestReport.ts` — if the report surfaces position-sizing or config
  labels, add the new sizer's label and the cost fields so exports don't render
  "unknown".

## Requirements

- **Costs UI**: two numeric inputs — "Cost per contract (per side)" and "Cost (bps of
  notional, per side)" — defaulting to 0/omitted. Omit the `costs` object from the
  request when both are 0, so old-shape requests stay byte-identical.
- **Inverse-vol sizer UI**: mode option "Inverse volatility (vol targeting)" with
  `target_volatility_pct` (default 10), optional `max_contracts`, `min_contracts`
  (default 0). Add a short inline hint that the mode requires a strategy exposing a
  volatility indicator (TSMOM does; others fall back to no trades — that's backend
  behavior, the hint just prevents confusion).
- **Hydration**: loading a historical run/study whose config contains `costs` and/or the
  new sizer restores the form exactly; configs without them behave as today.
- **Validation**: non-negative costs; `target_volatility_pct > 0`;
  `max_contracts >= min_contracts` when set — match how existing sizer validation is done.

## Tests

- Unit tests for the serialization + hydration round-trip of both new config surfaces
  (extend `hydrateConfigForm.test.ts` and whatever covers the request builder).
- A form-level test that both-zero costs omit the `costs` key from the payload.
- `pnpm test:run` green.

---

## Definition of done

- `pnpm test:run` passes. **Do not report completion until it does.**
- Manual check (state that you did it): run a backtest with `cost_per_contract > 0`
  against the local backend and confirm `total_commission` appears in metrics and PnL
  drops accordingly.

## Out of scope

- Any backend change.
- Strategy-specific forms (schema-driven; nothing to do).
- Displaying gross-vs-net PnL breakdowns in result panels beyond what `metrics` already
  carries (`total_commission` shows up via the generic metrics rendering if present).
