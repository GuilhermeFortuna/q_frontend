# Q-101 implementation plan: Stored and script runs open from Backtests history

> **For implementation agents:** Read the linked specification and repository instructions. Use superpowers:executing-plans when available. Launch only through `./work start Q-101 --agent <agent> --worktree` after written-plan approval and completed dependencies. Implement natively; delegation requires separate authorization.

**Goal:** A completed run opens from history into the full results view, and script runs are marked, filterable and review-only.
**Architecture:** A stored-result query feeds the existing results view through the backtest session slice; origin and provenance come from the Q-097 contract.
**Tech stack:** React 19, TypeScript, TanStack Query, Zustand, MSW, Vitest and Testing Library.
**Spec:** [Specification](../specs/Q-101-stored-and-script-runs-open-from-backtests-history-spec.md)
**Status:** written plan awaiting human review.

## Global constraints

- Reuse `BacktestResultsTabs`, `useBacktestPerformanceData` and the existing chart components unchanged; feed them, do not fork them.
- Never hand-edit vendored contract code; use `make contracts`.
- Stack-run behaviour in history is preserved except for the corrected wording.
- Tests run as `TZ=America/Sao_Paulo pnpm test:run` against MSW. No backend or Tauri run.
- Commit focused units on the task branch; no push, merge or protected-branch checkout.

## Review focus

- The id of an opened stored run and the id of a running job are separate state; neither overwrites the other.
- Opening a stored run issues exactly one result request and no job request.
- Every entry point that starts a job from a past run is closed for script runs, not only the visible Re-run button.
- The setup form is untouched when a script run is selected.
- Loading, missing-result and error states are distinct and readable.

## Ordered implementation

### 1. Pin the Q-097 contract and extend types, queries and mocks

**Files:** Modify `CONTRACTS_REV` and run `make contracts`; modify `src/types/backtesting.ts`, `src/api/queries/backtests.ts`, `src/mocks/handlers.ts` and `src/mocks/backtest.ts`; extend `src/api/queries/__tests__/`.
**Interfaces:** `origin` and `provenance` on run types; `origin` in history parameters; `useStoredBacktestResult(runId)`.

- [ ] Add failing query tests: the origin filter is sent; the stored-result query returns the result and surfaces `404` as a distinct state.
- [ ] Run the query tests and confirm they fail.
- [ ] Implement types, queries and MSW data for a stack run, a script run and a missing result.
- [ ] Run `make contracts-check` and the query tests.
- [ ] Commit this unit.

### 2. Open a stored run in the results view

**Files:** Modify the backtest session in `src/store/slices/jobSessionsSlice.ts`, `src/workspaces/backtests/BacktestsWorkspace.tsx`, `src/components/backtests/BacktestHistoryPanel.tsx` and the results header in `src/components/backtests/focus/`; extend `src/workspaces/backtests/__tests__/` and `src/components/backtests/__tests__/`.
**Interfaces:** Session field for the opened stored run; `onOpenResults(runId)` from the history panel.

- [ ] Add failing tests for spec acceptance items 1, 2, 5 and 6.
- [ ] Run them and confirm they fail because the action is missing.
- [ ] Implement the action, the session field, the header line naming the stored run, the way back to history, and the corrected wording.
- [ ] Run the workspace and history tests.
- [ ] Commit this unit.

### 3. Mark script runs and make them review-only

**Files:** Modify `src/components/backtests/BacktestHistoryPanel.tsx`, `src/components/backtests/BacktestHistoryFilters.tsx`, and the entry points that start a job from a past run (the ML filter training entry and any Optimize or Validate seeding found by searching for uses of the run detail's `config`); extend their tests.

- [ ] Add failing tests for spec acceptance items 3 and 4.
- [ ] Run them and confirm they fail.
- [ ] Implement the badge, the origin filter, the provenance block, and the closed entry points.
- [ ] Run `TZ=America/Sao_Paulo pnpm test:run` for the backtests and research areas.
- [ ] Commit this unit.

## Verification and handoff

- [ ] Run `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `make contracts-check`.
- [ ] Record the commands actually run and their results in this plan; do not claim unrun checks passed.
- [ ] Use `./work board set Q-101 in-review -m "<changes; checks and results; follow-ups>"`. State the manual step: publish from a research script against `./dev research` and open the run from history.
