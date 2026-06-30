# WO173 — Frontend: Execution workspace and paper controls

## Shared context (read first)

Read `docs/design/paper-live-execution.md` and WO171's completion contracts. This is a new top-level
operator workspace, not an execution engine. It must make paper/live state and worker health
unambiguous.

Frontend repo: `q_frontend`, managed with `pnpm`.

## Files to read

- WO171 completion message and sample contracts
- `src/app/router.tsx`
- `src/app/lazyWorkspaces.tsx`
- `src/components/dock/AppDock.tsx`
- `src/components/dock/DockIcons.tsx`
- `src/types/api.ts`
- `src/api/queries/experiments.ts`
- `src/workspaces/research/ExperimentsWorkspace.tsx`
- `src/workspaces/system/SystemWorkspace.tsx`

## Goal

Add a top-level `Execution` workspace where an operator can inspect paper accounts/deployments and
safely pause, stop, flatten, or engage the global kill switch without confusing API availability with
actual worker/market health.

## Tasks

1. Add the lazy `/execution` route, `execution` workspace ID, dock item/icon, route tests, and no eager
   inclusion in the main bundle.
2. Add `src/types/execution.ts` and `src/api/queries/execution.ts` for WO171 contracts, bounded
   pagination, mutations, and visible-only polling.
3. Create `src/workspaces/execution/ExecutionWorkspace.tsx` with:
   - persistent `PAPER` environment marker and disabled `LIVE LOCKED` capability;
   - account balance/equity/daily P&L/risk summary;
   - worker, database, market-data, quote, and last-bar health as separate signals;
   - deployment list and selected deployment detail;
   - current net position and mark-to-market;
   - paginated decisions, orders, fills, ledger entries, and risk events.
4. Add create-paper-account and create-deployment flows against immutable strategy choices returned by
   the backend. Validate timeframe/sizing/risk input without duplicating backend authority.
5. Add start/pause/stop controls with current/desired state feedback. Stop/pause language must state
   that positions remain open.
6. Add strongly confirmed flatten and global kill-switch controls. Show backend audit/result status;
   never optimistically claim a position closed.
7. Preserve unknown orders, stale data, worker-down, rejected, and failed-command detail as actionable
   states rather than generic error walls.
8. Add MSW fixtures for tests only; production starts from API state.

## Guardrails

- UI commands never execute or simulate fills locally.
- `PAPER` and `LIVE LOCKED` remain visible around every destructive control.
- API healthy does not render worker/market healthy.
- Hidden/off-route workspace stops polling.
- No unbounded history rendering; paginate or virtualize audit surfaces.
- No production import from `@/mocks`.
- Follow current design-system and performance-budget conventions; no new always-on canvas.

## Tests

- Route, lazy loading, dock, workspace ID, and bundle-splitting tests.
- Empty/loading/worker-down/stale/unknown/rejected/running fixtures.
- Account/deployment creation sends exact WO171 payloads.
- Start/pause/stop shows desired vs acknowledged state and accurate retained-position language.
- Flatten and kill switch require confirmation and wait for backend state.
- Inactive workspace stops all execution polling.
- Paginated history does not render unbounded rows.
- Run relevant Vitest suites, `pnpm typecheck`, `pnpm build`, and production mock-import grep.

## Docs

Update frontend workspace/API documentation and include screenshots for normal paper, stale/worker-down,
and kill-switch states.

## Definition of done

An operator can understand and control paper execution from one bounded, honest workspace without
reading logs or risking accidental live behavior.

## Out of scope

Backend execution, live enablement, strategy authoring, tick charts, and portfolio analytics.
