# WO75 — Frontend: retire the standalone `/strategy` page (route, nav, redirect, cleanup)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`

**Context for this work:** with **WO73** the Strategy Workbench now lives inside the Backtests
Simulation setup (StrategyStudio). This WO removes the now-dead standalone `/strategy` page: redirect
the route, drop the nav entry and `WorkspaceId` member, and delete the orphaned components/tests.

**Do WO73 first.** Do not remove the page before its replacement works. This is **frontend-only**.
Read the design doc: `q_frontend/docs/design/strategy-into-backtests.md`.

---

## How the pieces work today (read these files)

- `src/app/router.tsx` — `strategyRoute` (`path: '/strategy'`, `component: StrategyWorkspace`) is
  registered in `routeTree`. The index route's `beforeLoad` redirect logic already has precedent for
  remapping a retired workspace (see the `optimize` → `/backtests` handling) — mirror that for
  `strategy` → `/backtests`.
- `src/components/dock/AppDock.tsx` — dock items array; line ~30:
  `{ id: 'strategy', label: 'Strategy', to: '/strategy', icon: Cpu, enabled: true }`.
- `src/types/api.ts` — `WorkspaceId` union includes `'strategy'` (last member).
- `src/store/useAppStore.ts` (+ `slices/`) — `activeWorkspace` / `setActiveWorkspace`; check for any
  `'strategy'` default or persisted value that must be migrated to `'backtests'`.
- `src/workspaces/strategy/StrategyWorkspace.tsx` and
  `src/workspaces/strategy/StrategyWorkbenchActionBar.tsx` — the orphaned page + its
  navigate-to-backtests action bar. **Deleted in this WO.**
- Keep `src/workspaces/strategy/ExitConfigurator.tsx`, `ExitRuleCard.tsx`, `exitRuleSemantics.ts`,
  `exitWorkbenchGroups.ts` — **still used by StrategyStudio (WO73). Do NOT delete these.**

---

## Goal

`/strategy` (and any saved/persisted `activeWorkspace === 'strategy'`) lands the user on
`/backtests`; the Strategy dock tile is gone; `WorkspaceId` no longer has `'strategy'`; the dead page
files and their tests are removed; the app type-checks and builds.

## Tasks

### 1. Redirect the route

In `src/app/router.tsx`, replace `strategyRoute`'s component with a `beforeLoad` redirect to
`/backtests` (mirroring the `optimizeRoute` pattern), OR remove `strategyRoute` and add a redirect so
existing `/strategy` deep links don't 404. Keep one path that resolves `/strategy → /backtests`.
Remove the `StrategyWorkspace` import.

### 2. Migrate persisted/active workspace

In the index route `beforeLoad` (and/or the store), map a persisted `activeWorkspace === 'strategy'`
to `'backtests'` before it's used for redirect — same shape as the existing `research`→`launcher` and
`optimize`→`/backtests` remaps. This prevents a stale persisted value from dead-ending.

### 3. Remove the nav entry

Delete the `'strategy'` item from the `AppDock` items array. Remove the now-unused `Cpu` icon import
if nothing else uses it.

### 4. Drop the `WorkspaceId` member

Remove `'strategy'` from the `WorkspaceId` union in `src/types/api.ts`. Fix the resulting type errors
(there should be few — the dock item and any `'strategy'` literals).

### 5. Delete the orphaned files + tests

Delete `src/workspaces/strategy/StrategyWorkspace.tsx`,
`src/workspaces/strategy/StrategyWorkbenchActionBar.tsx`, and their tests
(`tests/unit/workspaces/StrategyWorkspace.test.tsx`, plus any `StrategyWorkbenchActionBar` test).
**Leave the exit-\* modules in `src/workspaces/strategy/` intact** (used by WO73). Grep for remaining
imports of the deleted files → none.

## Guardrails

> **WO73 ships first.** This WO assumes StrategyStudio already provides authoring + entry/exit tabs in
> Backtests. Do not start until WO73 is merged.

> **Don't break deep links.** `/strategy` must redirect to `/backtests`, not 404. Add a test.

> **Don't delete shared exit modules.** `ExitConfigurator`, `ExitRuleCard`, `exitRuleSemantics`,
> `exitWorkbenchGroups` stay — StrategyStudio imports them. Only `StrategyWorkspace.tsx` and
> `StrategyWorkbenchActionBar.tsx` are removed from that folder.

> **No orphan references.** After deletion, `grep -r "StrategyWorkspace\|StrategyWorkbenchActionBar\|
'/strategy'\|\"strategy\"" src` returns only the redirect mapping — nothing importing the dead page.

## Tests — `tests/unit/` (Vitest)

- Navigating to `/strategy` redirects to `/backtests` (route test).
- A persisted `activeWorkspace === 'strategy'` resolves to `/backtests` on initial load.
- The dock no longer renders a Strategy item.
- Remove `StrategyWorkspace`/`StrategyWorkbenchActionBar` tests.

## Docs

Update any README/nav doc that lists `/strategy` as a workspace; point strategy authoring to Backtests
→ Simulation.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` are clean.
  **Do not report completion until all three pass.**
- Manually (`./dev.sh`): the Strategy dock tile is gone; visiting `/strategy` lands on Backtests; a
  previously-saved session that pointed at Strategy opens Backtests; no console errors.
- Paste in the final message: the final `WorkspaceId` union, the `/strategy → /backtests` redirect
  mechanism, and confirmation that the shared exit-\* modules were retained.

## Out of scope

- StrategyStudio / tabs / inline authoring — **WO73**.
- Optimization-tab custom support — **WO74**.
- Any backend change.
