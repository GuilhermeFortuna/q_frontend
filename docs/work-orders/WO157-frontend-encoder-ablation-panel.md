# WO157 — Frontend: Encoder Ablation panel (Experiments tab)

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` (`pnpm test:run`, `pnpm typecheck`,
`pnpm build`) — never npm/yarn. Read `docs/design/discovery-payoff-validation.md` first. Depends on
**WO155** (encoder-ablation endpoint) and **WO156** (the Experiments tab shell + query/poll plumbing
this reuses). This is the second sub-panel of the Experiments tab.

## How the pieces work today (read these files)

- `src/workspaces/research/ExperimentsWorkspace.tsx` (WO156) — the Experiments tab shell with an
  `A/B Discovery` panel and a **placeholder slot** for `Encoder Ablation`. This WO fills that slot.
- `src/api/queries/experiments.ts` (WO156) — extend with the ablation hooks (same file/pattern).
- `src/types/experiments.ts` (WO156) — extend with the ablation request/result types.
- `src/mocks/experiments.ts` (WO156) — add MSW handlers for the ablation endpoints (tests only).
- **Table/poll precedents:** `src/components/research/FeatureScoringDashboard.tsx` (leaderboard table,
  live-poll) and `OptimizationAnalyticsTab.tsx`. UI primitives in `src/components/ui`.
- Backtests symbol/timeframe/date pickers — reuse for the launch form.

## Goal

A second Experiments sub-panel that launches an encoder ablation (a list of configs) and renders the
comparison table — which encoder wins on the gate (recon_r2, latent IC vs baseline, pass/fail).

## Tasks

### 1. Types + queries

- Extend `src/types/experiments.ts` with the WO155 shapes: `EncoderConfigSpec`,
  `EncoderAblationRequest`, `EncoderAblationRow` (`label`, `encoder_kind`, `model_hash`, `recon_r2`,
  `best_latent_ic`, `baseline_ic`, `ic_delta_vs_baseline`, `passed`, `gate_error`),
  `EncoderAblationResult` (`rows`, `best_label`).
- Extend `src/api/queries/experiments.ts` with `useStartEncoderAblation()` (`POST .../encoder-ablation`)
  - `useEncoderAblationRun(jobId, {isRunning})` polling query.

### 2. Encoder Ablation panel

- `EncoderAblationPanel.tsx` in the WO156 panel directory; mount it in the Experiments tab's placeholder
  slot.
- Launch form: instrument (symbol/timeframe pickers), target/horizon, train window dates, and a small
  **config-list builder** (add/remove rows of `{label, encoder_kind ∈ pca|ae, hyperparams}`). Submit
  calls the start mutation; while running, poll + show progress (configs done / total).
- On completion: a comparison **table**, one row per config — `recon_r2`, `best_latent_ic`,
  `baseline_ic`, `ic_delta_vs_baseline`, and a **pass/fail badge** (`passed`); rows with `gate_error`
  show a distinct "gate skipped" state with the error. Highlight `best_label`.

### 3. Loading / error / empty discipline

- Same three-state discipline as WO156: loading (polling) vs errored (`failed`/request error, show
  `gate_error`/`detail`) vs genuinely empty (no run yet → CTA). A per-row `gate_error` is **not** a
  panel-level error — the table still renders the other rows.

## Guardrails

> **No mocks in production paths.** No `@/mocks` outside `__tests__`/`*.test.*`; initial state is
> `null`/`[]`/empty-state. Same CI grep as WO156 (must be empty).
> **Fire-and-poll only.** Start-mutation + polling-query; never block on the endpoint.
> **Row-level gate failure ≠ panel failure.** A `gate_error` row renders with a "gate skipped" badge;
> the rest of the table is unaffected.
> **Reuse WO156 plumbing + primitives.** Same `experiments.ts` query module, same pickers, same
> `src/components/ui` primitives — do not fork a parallel pattern.

## Tests

- `src/components/research/experiments/__tests__/EncoderAblationPanel.test.tsx` (MSW):
  - Submitting the config-list form fires `POST .../encoder-ablation` and enters the polling state.
  - A mocked completed run renders one table row per config with recon_r2 / IC / pass badge and
    highlights `best_label`.
  - A mocked result containing a `gate_error` row renders the "gate skipped" badge for that row while
    the other rows render normally.
  - No-run initial state renders the empty-state CTA; a `failed` job renders the error state.

## Docs

- `docs/design/discovery-payoff-validation.md`: mark WO157 implemented — batch complete.
- Cross-link WO155 (endpoint) + WO156 (tab shell).

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm build` all pass — **do not report completion until they
  do.**
- Paste-in-final-message: markup/screenshot of the Encoder Ablation table with a PCA + AE row (one
  passing, the gate-skipped state shown if present), and confirmation the `@/mocks` grep check is empty.

## Out of scope

- The Discovery A/B panel + tab shell — **WO156**.
- Any backend change — **WO155** owns the endpoint.
- Automated hyperparameter sweep UI. Walk-forward refit.
