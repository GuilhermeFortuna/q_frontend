# WO138 — Frontend: Feature Store table + filters

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` (`pnpm test:run`, `pnpm typecheck`,
`pnpm lint`, `pnpm build`) — never npm/yarn. Read `docs/design/feature-intelligence.md`. Depends on
**WO137** (workspace shell + `useFeatureList` + types + MSW mocks). Renders the **Feature Store** tab.

**Principle:** the catalog as a sortable, filterable table — every feature at a glance with its type,
version, status, usage, and score — and a row click opens the Passport (WO139).

## How the pieces work today (read these files)

- `src/workspaces/research/ResearchWorkspace.tsx` (WO137) — the Feature Store tab placeholder to fill.
- `src/api/queries/features.ts` (WO137) — `useFeatureList(params)`; `src/types/features.ts` —
  `FeatureListItem` (`name`, `category`, `latest_version`, `status`, `usage_count`, `score`).
- `src/components/ui/` — `Panel`, `SectionHeader`, `FilterPills` (category/status filters),
  `StatTile`. A virtualized/large-table pattern already exists for backtest results
  (search `Virtuoso`/virtualization usage under `src/components/backtests` per WO100/WO105) — reuse it
  if the catalog can grow large; a plain table is fine for the v1 catalog (~dozens of rows).
- Status chip styling: `src/components/ui/chipStyles.ts` / `SegmentedToggle` accent ladders (WO116–123).

## Tasks

### 1. Table — `src/components/research/FeatureStoreTable.tsx`

- Columns: **Feature** (name), **Type** (category), **Version** (`latest_version`), **Status**
  (chip: experimental/candidate/production using the accent ladder), **Usage** (`usage_count`),
  **Score** (`global_score` formatted, or `—` when `null`).
- Sortable by every column (default: Score desc, nulls last). Sort state local.
- Row click → emits `onSelectFeature(name)` (WO139 mounts the Passport on this).

### 2. Filters — `FilterPills`

- Category pills (derive distinct categories from the list) + status pills
  (experimental/candidate/production). Pass the active filters into `useFeatureList({ category,
status })` (server-side filter) — don't filter client-side if the API already supports it (it does,
  WO131).
- A small `StatTile` row above the table: total features, # production, # scored.

### 3. Empty / loading / error states

- Loading: skeleton rows. Error: the inline error pattern from `OptimizationAnalyticsTab`. Empty
  (filters match nothing): a `Panel` empty state with a "clear filters" affordance.

## Guardrails

> **Server-side filtering.** Category/status go to the API query params; don't refetch-all-then-filter.
> **Design system only.** `Panel`/`FilterPills`/`StatTile`/chip styles — no bespoke table chrome
> beyond the cells.
> **Score honesty.** A `null` score renders `—`, never `0`; a `leakage_status !== 'clean'` feature (if
> present in the list item) shows a warning marker so a suspect feature is never silently top-ranked.

## Tests

- `src/components/research/__tests__/FeatureStoreTable.test.tsx` (against MSW fixtures):
  - renders one row per feature with all six columns; `null` score shows `—`.
  - sorting by Score orders desc with nulls last; sorting by Usage reorders.
  - selecting a category pill refetches with `?category=`; clicking a row fires `onSelectFeature`.

## Docs

- `docs/design/feature-intelligence.md`: tick the Feature Store table landed.

## Definition of done

- `pnpm typecheck && pnpm lint && pnpm test:run` pass; `pnpm build` succeeds — **do not report
  completion until they do.**
- Paste-in-final-message: confirmation the table renders, sorts by score (nulls last), and filters
  server-side by category + status.

## Out of scope

- The Passport detail panel the row opens — **WO139**. Scoring dashboard — **WO140**.
