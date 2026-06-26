# WO139 — Frontend: Feature Passport detail panel

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` (`pnpm test:run`, `pnpm typecheck`,
`pnpm lint`, `pnpm build`) — never npm/yarn. Read `docs/design/feature-intelligence.md`. Depends on
**WO137** (`useFeaturePassport`, `useSetFeatureStatus`, types) + **WO138** (the table's
`onSelectFeature`). Renders the **Feature Passport** — everything about one feature in one panel.

**Principle:** the Passport is the single source of truth for a feature — definition, inputs, params,
version, provenance, leakage status, best symbols/timeframes, evaluation history — plus the one
mutation in this batch: promote/demote status.

## How the pieces work today (read these files)

- `src/components/research/FeatureStoreTable.tsx` (WO138) — emits `onSelectFeature(name)`.
- `src/api/queries/features.ts` (WO137) — `useFeaturePassport(name)`, `useSetFeatureStatus()`;
  `src/types/features.ts` — `FeaturePassport` (`name`, `category`, `description`, `usage_count`,
  `versions[]` with `version/status/node_kind/param_keys/default_params/forward_window/leakage_status/
provenance`, `score`, `evaluation_history[]`).
- `src/components/ui/` — `Panel`, `PanelHeader`, `SectionHeader`, `LabeledField`, `StatTile`,
  `SegmentedToggle` (status control), `Button`, `EntityCard`. Status accent ladders from WO116–123.
- `src/components/optimize/` — example of a detail-side panel paired with a table (layout reference).

## Tasks

### 1. Passport panel — `src/components/research/FeaturePassport.tsx`

- Mounts when a feature is selected; takes `name`, calls `useFeaturePassport(name)`. Slides in
  beside/over the table (follow the existing master-detail layout in the workspace).
- Header: feature name + category + a **leakage badge** (`clean` neutral, `suspect`/`unverified` warn)
  - the current `score` as a `StatTile`.
- **Definition** section (`LabeledField`s): description, `node_kind`, inputs (`param_keys`),
  `default_params`, `forward_window` (should read `0` for every feature — surface it so a non-zero ever
  showing up is visible).
- **Versions** section: one row per version with its status; the **active** version's status is
  editable via a `SegmentedToggle` (experimental/candidate/production) wired to `useSetFeatureStatus`
  (optimistic update + invalidate `passport` + `list` keys on success; revert on error).
- **Provenance** section: author/model, source WO, created date.
- **Evaluation history** section: `evaluation_history[]` as a compact list/sparkline (run, target,
  rank_ic, global_score, date), newest first; empty-state when none yet.
- **Best symbols / timeframes**: render from `evaluation_history` if the backend supplies them; else an
  explicit "no evaluations yet" empty state (do not fabricate).

### 2. Status mutation UX

- Promotion/demotion is immediate (optimistic), with a toast/inline confirmation. On failure, revert
  the toggle and show the error. No multi-step wizard — it's a single field.

## Guardrails

> **Read-mostly.** The only write is the status toggle. The panel never triggers an evaluation or edits
> recipe fields.
> **Leakage visible.** A `suspect`/`unverified` feature shows the badge prominently; never hide it
> behind a tab.
> **No fabricated metadata.** Best symbols/timeframes/eval history come from the API; absent data → an
> honest empty state, not placeholder numbers.
> **Design system only.** `LabeledField`/`SectionHeader`/`SegmentedToggle`/`StatTile`.

## Tests

- `src/components/research/__tests__/FeaturePassport.test.tsx` (MSW fixtures):
  - renders definition + versions + provenance for a fixture feature; `forward_window` shows `0`;
    a `suspect` fixture shows the leakage badge.
  - the status `SegmentedToggle` calls `useSetFeatureStatus` and optimistically reflects the new status;
    a mocked failure reverts it.
  - empty `evaluation_history` shows the "no evaluations yet" state.

## Docs

- `docs/design/feature-intelligence.md`: tick the Passport panel landed.

## Definition of done

- `pnpm typecheck && pnpm lint && pnpm test:run` pass; `pnpm build` succeeds — **do not report
  completion until they do.**
- Paste-in-final-message: confirmation selecting a row opens the Passport, the status toggle
  round-trips (optimistic + revert-on-error), and the leakage badge shows for a suspect feature.

## Out of scope

- The Feature Scoring dashboard (leaderboard/heatmap/clusters) — **WO140**.
- Triggering evaluations — **WO141** (Feature Lab).
