# WO137 — Frontend: Research workspace shell + nav + query/types layer + mocks

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` (`pnpm test:run`, `pnpm typecheck`,
`pnpm lint`, `pnpm build`) — never npm/yarn. Read `docs/design/feature-intelligence.md`. This is the
**foundation WO of the Research frontend batch (WO137–141)**: it adds the workspace + nav + route +
the typed query layer + MSW mocks that WO138–141 build their panels on. Backend deps: **WO131**
(Feature Store + Passport API) and **WO135** (eval + leaderboard API) — this WO targets those exact
endpoints. WO138–141 have **no dependency on the backend being live** because of the mocks here.

**Principle:** stand up the Research workspace as a tabbed shell (Feature Store · Feature Scoring ·
Feature Lab) with a fully-typed react-query layer and MSW handlers, so the three feature surfaces can
be built and tested in isolation.

## How the pieces work today (read these files)

- `src/types/api.ts` — `WorkspaceId` union. **Note: `'research'` is already referenced defensively in
  the router but is NOT yet in the union — add it.**
- `src/components/dock/AppDock.tsx` — the `NAV`/dock item array (`{ id, label, to, icon, enabled }`,
  lines ~27–33). **Add the Research entry here.**
- `src/app/router.tsx` — TanStack Router; `createRoute` + `syncWorkspace(id)` pattern; the index route
  currently coerces a legacy `'research'` active id back to launcher (remove that coercion now that
  Research is real). `src/app/lazyWorkspaces.tsx` — the `lazy(() => import(...))` workspace registry.
- `src/workspaces/<name>/<Name>Workspace.tsx` — every workspace is one top component
  (e.g. `discover/DiscoverWorkspace.tsx`).
- `src/api/queries/optimize.ts` — **the query-layer template**: `optimizeKeys` factory + `useQuery`/
  `useMutation` hooks wrapping `apiClient` (`src/api/client.ts`, an axios instance). Mirror this.
- `src/types/optimization.ts` — response-type module style.
- `src/mocks/handlers.ts` + per-domain mock modules (`src/mocks/strategySearch.ts`, …) — MSW handler
  pattern; `src/mocks/browser.ts` wires the worker.
- `src/components/ui/` (`index.ts`) — design-system primitives (`Panel`, `SectionHeader`,
  `SegmentedToggle`, `StatTile`, `FilterPills`, `EntityCard`, `Card`, `Button`) from WO116–123. **Use
  these — do not hand-roll containers/toggles.**

## Tasks

### 1. Workspace id + nav + route

- Add `'research'` to the `WorkspaceId` union in `src/types/api.ts`.
- Add a dock entry in `AppDock.tsx`: `{ id: 'research', label: 'Research', to: '/research', icon:
ResearchIcon, enabled: true }` (reuse an existing lucide icon or the dock's icon convention).
- Add `researchRoute` in `router.tsx` (`path: '/research'`, `beforeLoad: () => syncWorkspace('research')`)
  wrapped in `LazyRouteBoundary`; register it on the root route. Remove the legacy `'research' →
launcher` coercion in the index route's `beforeLoad`.
- Add `LazyResearchWorkspace` to `lazyWorkspaces.tsx` (lazy import → code-split island, per WO99).

### 2. Tabbed shell — `src/workspaces/research/ResearchWorkspace.tsx`

- A `SegmentedToggle` across three tabs: **Feature Store** | **Feature Scoring** | **Feature Lab**
  (Neural Features is intentionally absent — gated on backend Phase 3/4; leave a code comment).
- Each tab renders a placeholder panel for now (`<Panel>` with a `SectionHeader`); WO138/140/141 fill
  them. Tab state is local; persist the selected tab in the URL search param (`?tab=`) following the
  backtests route's `validateSearch` pattern so deep links work.

### 3. Typed query layer — `src/api/queries/features.ts` + `src/types/features.ts`

- `src/types/features.ts`: `FeatureListItem`, `FeatureListResponse`, `FeatureVersionDetail`,
  `FeaturePassport`, `FeatureStatus` (`'experimental'|'candidate'|'production'`), `FeatureEvalRun`,
  `FeatureScoreRow`, `FeatureLeaderboardRow`, `EvalRunRequest` — matching the WO131/WO135 JSON shapes
  exactly (mirror them from those WOs).
- `src/api/queries/features.ts`, modeled on `optimize.ts`:
  - `featureKeys` factory (`all`, `list(params)`, `passport(name)`, `leaderboard`, `evalRun(id)`).
  - `useFeatureList(params)`, `useFeaturePassport(name)`, `useFeatureLeaderboard()`,
    `useFeatureEvalRun(runId, { isRunning })` (poll while running, mirror `useOptimizationAnalytics`'s
    refetch behavior), `useSetFeatureStatus()` (mutation → POST), `useStartFeatureEval()` (mutation →
    POST `/api/v1/feature-eval`). All wrap `apiClient`; invalidate the right keys on mutation success.

### 4. MSW mocks — `src/mocks/features.ts` + register in `handlers.ts`

- Handlers for `GET /api/v1/features`, `GET /api/v1/features/:name`,
  `POST /api/v1/features/:name/:version/status`, `GET /api/v1/features/leaderboard`,
  `POST /api/v1/feature-eval`, `GET /api/v1/feature-eval/:id` returning representative fixtures
  (a handful of features across categories with scores, one eval run with a leaderboard + clusters +
  heatmap). Register in `src/mocks/handlers.ts`.

## Guardrails

> **Use the design system.** Containers = `Panel`, toggles = `SegmentedToggle`, metrics = `StatTile`,
> filters = `FilterPills`. No bespoke equivalents (WO116–123 already standardized these).
> **Lazy island.** The Research workspace is a lazy-loaded chunk; it must not be imported eagerly into
> the main bundle (verify the `pnpm build` chunk graph — Research lands in its own chunk like the other
> workspaces, per WO99/WO106).
> **Mocks are the contract.** WO138–141 build against these handlers; keep fixture shapes identical to
> the WO131/WO135 response types so swapping to the live API is a no-op.

## Tests

- `src/workspaces/research/__tests__/ResearchWorkspace.test.tsx`: renders the three tabs; switching tab
  updates `?tab=`; deep-linking `?tab=scoring` opens the Scoring tab.
- `src/app/__tests__/` (extend the existing route test): `/research` resolves to the Research workspace
  and sets `activeWorkspace='research'`.
- `src/api/queries/__tests__/features.test.ts`: `useFeatureList` + `useFeaturePassport` resolve against
  MSW fixtures with correctly-typed data.

## Docs

- `docs/design/feature-intelligence.md`: add a short "Research frontend (WO137–141)" section noting the
  workspace + three tabs + deferred Neural Features.

## Definition of done

- `pnpm typecheck && pnpm lint && pnpm test:run` pass, and `pnpm build` succeeds with Research in its
  own chunk — **do not report completion until they do.**
- Paste-in-final-message: confirmation `/research` renders the three-tab shell, `?tab=` deep-links
  work, and the Research chunk is separate in the build output.

## Out of scope

- The Feature Store table — **WO138**. Passport detail — **WO139**. Scoring dashboard — **WO140**.
  Feature Lab — **WO141**. Neural Features tab — deferred (backend Phase 3/4).
