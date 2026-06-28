# WO148 — Frontend: Neural Features tab (read + promote)

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` + Vite + Tauri; tests `pnpm test`.
Read `docs/design/neural-features.md`. Depends on **WO146** (neural REST: list / detail / status
endpoints). This WO lights up the long-reserved Neural Features tab in the Research workspace — the
slot `ResearchWorkspace.tsx` already documents as _"intentionally deferred until backend Phase 3/4
lands."_ It delivers **read + promote** only; the training launch form is **WO149**.

## How the pieces work today (read these files)

- `src/workspaces/research/ResearchWorkspace.tsx` — the tabbed workspace. Line ~14 holds the
  _"Neural Features tab is intentionally deferred…"_ comment; `TAB_OPTIONS` + `SegmentedToggle` drive tabs;
  each tab is a small local component. **This is where the tab is registered and the comment is removed.**
- `src/types/features.ts` — `ResearchTab` union (`'store' | 'scoring' | 'lab'`); extend it.
- `src/app/__tests__/researchRoute.test.ts` + the research route definition — the `?tab=` search param is
  validated here; add `'neural'` to the allowed values.
- `src/api/queries/features.ts` — **the precedent to mirror**: `useFeatureLeaderboard`/`useFeaturePassport`
  (`useQuery`), `useSetFeatureStatus` (`useMutation` + `queryClient.invalidateQueries`), `staleTime`/retry
  conventions, and the typed `fetch*` helpers they wrap.
- `src/components/research/FeatureScoringDashboard.tsx` + `FeaturePassport.tsx` — house patterns for a
  list/leaderboard + a detail side-panel, and for status badges. Reuse their visual primitives.
- `src/components/ui/SegmentedToggle.tsx` — the tab control.

## Goal

A `'neural'` tab showing the registered neural models with their status, validation metrics, and gate
verdict (best latent IC vs the classical baseline), and a control to promote/demote a version through the
WO146 status endpoint. Reuse the existing list + detail-panel + status-badge patterns; no new design
language.

## Tasks

### 1. API layer — `src/api/queries/neural.ts`

- `useNeuralModels(params?)` → `useQuery` over `GET /api/v1/neural/models` (optional `status` filter).
- `useNeuralVersion(modelHash | null)` → `useQuery` over `GET /api/v1/neural/models/{hash}`, `enabled` when a
  hash is selected (mirror `useFeaturePassport`'s null-guarding).
- `useSetNeuralModelStatus()` → `useMutation` posting to `.../status`, invalidating the models + version
  queries on success (mirror `useSetFeatureStatus`). Surface the 409 illegal-transition error to the caller.
- Typed `fetch*` helpers + response types in `src/types/` mirroring how `features.ts` is structured. **No
  `any`.** If MSW fixtures exist for features, add neural fixtures alongside (`src/mocks/`).

### 2. Register the tab — `ResearchWorkspace.tsx` + route + type

- Add `{ value: 'neural', label: 'Neural Features' }` to `TAB_OPTIONS`; add `'neural'` to `ResearchTab` and
  to the route's `?tab=` allow-list; **remove the "intentionally deferred" comment.**
- Add the `tab === 'neural' ? <NeuralFeaturesTab /> : null` branch, following the existing per-tab component
  shape (list on the left, optional detail side-panel on the right, like Store/Scoring).

### 3. Models list + detail panel — `src/components/research/neural/`

- `NeuralModelList`: rows from `useNeuralModels` — name/`model_key`, symbol·timeframe, kind, `n_latents`,
  **status badge** (TRAINED / CANDIDATE / PRODUCTION / ARCHIVED), created-at; selecting a row opens the panel.
- `NeuralModelDetail`: from `useNeuralVersion` — `val_metrics` (reconstruction R²/MSE), `train_start/end`,
  `latent_names`, and the **gate verdict**: `best_latent_ic` vs `baseline_ic` with a clear pass/fail
  indicator and `n_latents_beating_baseline`. When no gate result exists yet, say so plainly (don't fake one).
- **Promote control**: a status action (e.g. "Promote to Production", "Archive") gated to the legal next
  states for the current status, calling `useSetNeuralModelStatus`. Confirm before promoting to PRODUCTION.
  Show the 409 message inline if the backend rejects the transition.

### 4. Honest empty/loading/error states

- Distinguish _loading_ / _errored_ / _genuinely empty_ — do **not** collapse them into one silent message
  (the bug pattern seen in the Backtests strategy panels). Errored list/detail queries show a retry
  affordance; an empty registry shows a "no neural models yet — train one from the launch form (coming in
  the next slice)" message, not a blank panel.

## Guardrails

> **Reuse, don't reinvent.** List/detail/badge/side-panel come from existing Research components and UI
> primitives; this tab should look like it always belonged.
> **Read + promote only.** No training launch here (WO149). The empty state may _point_ at the future launch
> form but must not implement it.
> **Promotion is deliberate.** PRODUCTION promotion requires explicit confirmation; only legal transitions
> are offered; backend remains the source of truth (a rejected transition surfaces, never silently succeeds).
> **No fabricated metrics.** Missing gate result / val_metrics render as "not evaluated", never as zero.

## Tests

- `src/api/queries/__tests__/neural.test.ts`: hooks parse list/detail; `useSetNeuralModelStatus` invalidates
  the right queries and propagates a 409.
- `src/components/research/neural/__tests__/`: list renders rows + status badges; detail renders the gate
  verdict (pass and fail cases) and the "not evaluated" state; the promote control offers only legal next
  states and confirms before PRODUCTION.
- `src/workspaces/research/__tests__/ResearchWorkspace.test.tsx`: the `'neural'` tab is selectable and
  renders the list; the route accepts `?tab=neural`.

## Docs

- `docs/design/neural-features.md`: tick the read+promote tab as landed; note the launch form follows in WO149.
- Cross-link [[neural-features-batch]] / [[visual-design-system-batch]] (reused primitives).

## Definition of done

- `pnpm test` (+ typecheck/lint per repo convention) passes — **do not report completion until it does.**
- Paste-in-final-message: a screenshot or description of the Neural Features tab showing a model's status
  badge + gate verdict, and the promote action transitioning a CANDIDATE to PRODUCTION (or the 409 surfaced
  for an illegal one).

## Out of scope

- Training launch form + progress — **WO149**.
- Latent Space Explorer / Market Similarity Search / per-latent charting — deferred (design "Out of scope").
