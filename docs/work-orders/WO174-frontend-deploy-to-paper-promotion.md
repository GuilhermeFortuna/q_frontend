# WO174 — Frontend: promote validated strategies into paper deployments

## Shared context (read first)

Read `docs/design/paper-live-execution.md`, WO171's API contracts, and WO173's Execution workspace.
This WO connects existing Research/Backtest outputs to the one canonical deployment flow; it must not
create a second execution path.

Frontend repo: `q_frontend`, with a small backend addition allowed only if WO171 lacks an immutable
strategy-version listing endpoint. Frontend uses `pnpm`; backend uses `uv`.

## Files to read

- WO171 and WO173 completion messages
- `src/components/research/experiments/AlphaResearchPanel.tsx`
- `src/lib/research/alphaResearch.ts`
- `src/workspaces/backtests/BacktestsWorkspace.tsx`
- `src/components/backtests/StrategyStudio.tsx`
- `src/lib/discover/promoteCandidate.ts`
- `src/stores/useAppStore.ts`
- `src/app/router.tsx`
- `src/api/queries/execution.ts`

## Goal

Let an operator promote an immutable saved strategy or `ready_for_paper` frozen champion into a
prefilled paper deployment, review all execution/risk settings, and activate it only from Execution.

## Tasks

1. Define one `PendingPaperDeployment` navigation/store contract containing immutable strategy
   identity/hash, symbol, timeframe, engine, sizing defaults, source provenance, and suggested risk
   limits. Do not copy mutable form objects by reference.
2. Add `Deploy to Paper` to completed Alpha Research only when the verdict is `ready_for_paper` and a
   frozen champion/config hash exists. Preserve profile/run/champion provenance.
3. Add `Deploy to Paper` in Backtests for saved/versioned runnable strategy configurations. If the
   current setup is unsaved or mutable, require save/versioning first.
4. Navigate to `/execution` with the prefilled draft. The operator must review paper account, symbol,
   timeframe, sizing, daily-loss/notional limits, and retained-position lifecycle semantics before
   creation.
5. Create through WO171's canonical endpoint; do not start automatically. Successful creation selects
   the deployment in Execution, where start is a separate explicit action.
6. Show incompatibility reasons for tick engine, timeframe below M15, missing immutable identity,
   unsupported multi-symbol strategy, or missing paper account.
7. Add source provenance to the deployment detail and link back to the originating research/backtest
   record when available.

## Guardrails

- `ready_for_paper` is eligibility, not automatic deployment or live readiness.
- No deployment from rejected/inconclusive research output.
- No deployment from ephemeral form state or raw generated Python.
- No automatic start and no live-mode option.
- Reuse WO171/WO173; do not add another broker/API/execution store.
- Existing promote-to-Backtest/Optimize behavior remains unchanged.

## Tests

- Ready Alpha result creates the exact pending draft/provenance; rejected/inconclusive results expose
  no deploy action.
- Saved Backtest config can promote; unsaved/mutable config must save first.
- Unsupported tick/sub-M15/multi-symbol cases show specific blockers.
- Draft survives route navigation without mutating source state.
- Create sends exact WO171 payload and does not auto-start.
- Successful creation selects the canonical Execution deployment.
- Run relevant Vitest suites, `pnpm typecheck`, `pnpm build`, backend tests if touched, and production
  mock-import grep.

## Docs

Update the Alpha Research and Backtests workflow docs to distinguish research eligibility, paper
deployment, and locked live execution.

## Definition of done

Validated strategies move into paper execution through one traceable, review-before-start workflow
with no mutable or implicit execution state.

## Out of scope

Research acceptance changes, automatic activation, live deployment, tick/sub-second strategies, and
portfolio deployment.
