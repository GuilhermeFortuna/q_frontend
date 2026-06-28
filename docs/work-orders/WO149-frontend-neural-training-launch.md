# WO149 — Frontend: train an encoder from the Neural Features tab

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` + Vite + Tauri; tests `pnpm test`.
Read `docs/design/neural-features.md`. Depends on **WO147** (training-job REST: `POST .../train` +
`GET .../train/{job_id}`) and **WO148** (the Neural Features tab + models list/detail it refreshes into).

This is the payoff of the slice: a user can **train an encoder end-to-end from the app** — no terminal —
watch progress, and see the result land in the models list with its gate verdict. It completes the
full lifecycle (train → monitor → inspect → promote) entirely in the Research workspace.

## How the pieces work today (read these files)

- `src/components/research/FeatureLab.tsx` + `FeatureLabInstrumentFields.tsx` + `FeatureLabFeaturePicker.tsx`
  — **the precedent to mirror**: an instrument/window field set + a feature picker that assembles a request,
  fires a "start" mutation, records a recent run, and hands a `runId` back up. The training form is the same
  shape with neural fields.
- `src/api/queries/features.ts` — `useStartFeatureEval` (`useMutation` returning a `runId`) +
  `useFeatureEvalRun(runId, { isRunning })` (polling `useQuery` with `refetchInterval` while running). Mirror
  both for training.
- `src/workspaces/research/ResearchWorkspace.tsx` — how a started eval flows (`onEvalStarted` → record run →
  switch view). The neural tab tracks an active training `job_id` the same way.
- `src/api/queries/neural.ts` (WO148) — `useNeuralModels` / `useNeuralVersion` to invalidate/refresh when a
  job completes.

## Goal

A "Train encoder" form in the Neural Features tab that posts a training request, polls the job to
completion with visible progress, and on success refreshes the models list and surfaces the new version's
gate verdict — reusing the Feature Lab launch + poll patterns.

## Tasks

### 1. API layer — extend `src/api/queries/neural.ts`

- `useStartNeuralTraining()` → `useMutation` over `POST /api/v1/neural/models/train`, returning `{ job_id }`
  (mirror `useStartFeatureEval`).
- `useNeuralTrainingRun(jobId | null, { isRunning })` → polling `useQuery` over `GET .../train/{job_id}` with
  a `refetchInterval` while `status` is `queued|running`, stopping on `completed|failed` (mirror
  `useFeatureEvalRun`). Typed payload: `status`, `progress`, `model_hash?`, `val_metrics?`, `gate?`, `error?`.

### 2. Training form — `src/components/research/neural/NeuralTrainForm.tsx`

- Fields (reuse `FeatureLabInstrumentFields` / `FeatureLabFeaturePicker` where they fit):
  - `kind`: PCA (linear control) | Autoencoder (primary) — default Autoencoder, with a one-line note that
    PCA is the cheap baseline.
  - `symbol`, `timeframe`, `train_start`, `train_end` (reuse the instrument/date fields).
  - `n_latents` (numeric, ≥ 1).
  - `input_features`: multi-select from the classical feature catalog (reuse the Lab's feature picker);
    prefill the WO146/CLI default set.
  - optional `evaluate`: target + horizon (when set, the backend runs the gate after training).
- Client-side validation mirrors the backend (`train_end > train_start`, `n_latents ≥ 1`, ≥1 feature) with
  inline messages; disable submit until valid.

### 3. Launch + progress wiring

- On submit → `useStartNeuralTraining` → store the returned `job_id` as the active run (same place
  `ResearchWorkspace` tracks a started eval) → `useNeuralTrainingRun` polls it.
- Progress UI: show the phase/percent from the status payload (`building_window` → `training` →
  `evaluating` → `done`); a `failed` job shows the error message + a "try again" affordance, never a silent
  stall.
- On `completed`: invalidate `useNeuralModels` (and select the new `model_hash` so `NeuralModelDetail` opens
  on it), surfacing the fresh **gate verdict** the user just produced.

### 4. Recent training runs (optional, match the Lab)

- If it stays cheap, keep a small "recent training runs" list like `FeatureLab`'s, each reopening its
  status/detail. Drop it if it bloats the WO — the models list already shows results.

## Guardrails

> **Mirror the Lab.** Launch (mutation → job_id) + poll (`refetchInterval` while running) + record-run come
> straight from `useStartFeatureEval`/`useFeatureEvalRun`/`ResearchWorkspace`. No bespoke polling loop.
> **Validate before sending.** The form blocks obviously-invalid requests client-side; the backend stays the
> authority and its 4xx surfaces inline.
> **Failures are visible.** A `failed` job renders its message; the form never appears to hang. (Avoid the
> conflated loading/empty/error pattern from the Backtests panels.)
> **No promotion shortcut.** A completed training leaves the model `TRAINED`/`CANDIDATE`; promotion is the
> deliberate WO148 control. This form trains; it does not promote.

## Tests

- `src/api/queries/__tests__/neural.test.ts` (extend): `useStartNeuralTraining` returns a `job_id`;
  `useNeuralTrainingRun` polls while running and stops on a terminal status.
- `src/components/research/neural/__tests__/NeuralTrainForm.test.tsx`: validation blocks bad input; submit
  fires the mutation with the assembled body; a `completed` poll triggers list invalidation + selection of
  the new hash; a `failed` poll shows the error + retry.
- `ResearchWorkspace.test.tsx` (extend): starting a training run from the neural tab tracks the active
  `job_id` and reflects completion.

## Docs

- `docs/design/neural-features.md`: tick the launch form as landed — the full train → monitor → inspect →
  promote lifecycle is now in-app; mark the slice's frontend complete.
- Cross-link [[neural-features-batch]]; update the batch summary that the Neural Features tab is fully live.

## Definition of done

- `pnpm test` (+ typecheck/lint per repo convention) passes — **do not report completion until it does.**
- Paste-in-final-message: a description/screenshot of training an autoencoder from the form — request body,
  the progress phases observed, and the completed model appearing in the list with its gate verdict — i.e.
  the first model trained without touching the terminal.

## Out of scope

- Backend training pipeline — **WO147** (this WO only drives it).
- Hyperparameter search / multi-run sweeps / scheduling — single-run training only.
- Latent Space Explorer / Market Similarity Search — deferred (design "Out of scope").
