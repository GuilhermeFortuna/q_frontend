# WO37 — Frontend: parallel optimization UX (worker count + control)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Format: `pnpm prettier --check`

**Context for this batch ("Parallel Optimization"):** WO35/WO36 made the Optimize tab run
Optuna trials across worker processes for candle studies. The status payload now carries a
`workers` count, and the optimize request's study config accepts an optional `max_workers`.
This work order surfaces both in the UI: show the user their cores are working during a run,
and (optionally) let them cap the worker count. It is **frontend only**.

**Prerequisite shipped:** WO36 (the `workers` status field + `study.max_workers` request
field — build against the exact JSON pasted in WO36's completion message).

**Proven precedent — mirror it.** The walk-forward batch already did the equivalent UX:
`src/components/walkforward/WalkForwardProgress.tsx` reads `status.workers` and renders
"Optimizing N windows · M in parallel" when `workers > 1`, and `src/types/walkforward.ts`
added `workers?: number` (status) and `max_workers?: number | null` (config). Match that
look and structure.

---

## Read these files first

- `src/components/optimize/OptimizationProgress.tsx` — the live progress UI during a study
  (currently shows completed/total trials + best value). This is where the parallel banner
  goes.
- `src/types/optimization.ts` — the optimize status + config TS types (`completed_trials`,
  `n_trials`, etc.). Add the additive fields here.
- `src/components/optimize/OptimizeStudySection.tsx` / `OptimizeAdvancedSection.tsx` — the
  study-config form fields (n_trials, seed, sampler, pruner). The optional `max_workers`
  control belongs in the advanced section.
- `src/api/queries/optimize.ts` — the status query + request builder; confirm where the
  study config is assembled into the POST body.
- `src/components/walkforward/WalkForwardProgress.tsx` + `src/types/walkforward.ts` — the
  reference implementation to copy.

---

## Goal

During a parallel study the user sees "Running N trials · M in parallel" (or equivalent), and
can optionally set a worker cap in advanced settings. With `workers` absent or `1`, the UI is
exactly as it is today (graceful against a pre-WO36 backend).

## Tasks

### 1. Types (additive)

In `src/types/optimization.ts`:

- Add `workers?: number` to the optimize **status** type.
- Add `max_workers?: number | null` to the study **config** type (whichever type maps to the
  request's `study` block). Document: omit/null = auto (one worker per CPU).

### 2. Progress banner

In `OptimizationProgress.tsx`, when `(status.workers ?? 1) > 1`, render a parallel indicator
in the same visual language as `WalkForwardProgress` (e.g. a line/chip reading
`Running ${n_trials} trials · ${workers} in parallel`). When `workers` is absent or `1`, the
component renders unchanged. Keep the existing completed/total trial bar and best-value
readout — the worker line is additive, not a replacement.

### 3. Optional `max_workers` control

In the advanced study-config section, add an optional numeric input "Worker processes"
(empty = Auto). Wire it into the request builder so an empty value omits `max_workers`
(backend treats it as auto) and a number sends `max_workers: <n>`. Use the existing field
components/validation patterns in that section (min 1, integer). Do not change defaults — an
untouched form must produce a byte-identical request to today's (omitting `max_workers`).

### 4. Tests

- `OptimizationProgress`: with `workers: 8` in the status, the parallel line renders with the
  right count; with `workers` omitted or `1`, it does not (mirror the
  `WalkForwardProgress.test.tsx` cases).
- Request builder: empty worker field ⇒ no `max_workers` key in the payload; a number ⇒
  `study.max_workers` set. (A small snapshot/assertion on the built request.)
- Existing optimize component/query tests green and unmodified.

---

## Definition of done

- `pnpm typecheck`, `pnpm test:run`, and `pnpm prettier --check` on touched files all pass.
  **Do not report completion until they do.**
- An untouched optimize form produces the same POST body as before (no `max_workers` key).
- The progress UI degrades cleanly against a backend that doesn't send `workers`.

## Out of scope

- Any backend change (WO35/WO36).
- Per-trial worker attribution / a live "which worker ran which trial" view.
- Surfacing `max_workers` on the walk-forward form (that batch already has its own field path
  if desired; not this WO).
