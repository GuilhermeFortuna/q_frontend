# Optimization Analytics (Optuna-derived diagnostics)

Goal: add the diagnostic views that `optuna.visualization` ships but we don't have, so a user can
understand **why** a search succeeds/fails — without pulling Plotly into the app.

**Principle:** Optuna does the _computation_, our existing chart stack (recharts/visx) does the
_rendering_. No Plotly runtime, no second charting aesthetic. We steal the analytics, not the
renderer.

## Scope

v1 = three views, chosen for highest diagnostic value / lowest surface area:

1. **Param importance** — `optuna.importance.get_param_importances(study)` (fANOVA). Which knobs
   actually move the objective. End-of-run only (expensive + noisy with few trials).
2. **Parallel coordinate** — every completed trial as a polyline across params + objective; reveals
   good/bad regions. **Live.**
3. **Pareto front** — for multi-objective (return vs drawdown) studies, the non-dominated set
   (`study.best_trials`); for single-objective, degrades to best-value highlight. **Live.**

Deferred to a possible v2: slice, contour, EDF.

## Live vs end-of-run

| View                | While running                             | When finished     |
| ------------------- | ----------------------------------------- | ----------------- |
| Parallel coordinate | partial (completed trials so far)         | full              |
| Pareto front        | partial frontier, updates trial-by-trial  | full              |
| Param importance    | `pending` (needs ≥ MIN_TRIALS, expensive) | computed + cached |

The endpoint is **state-aware**, not "finished-only": while `running` it returns the two live
datasets and `param_importances: null`; once terminal it returns all three.

## Architecture

### Backend (`q_backend`)

```
OptimizationStudy.config (Postgres app table)  ──model_validate──▶ OptimizationConfig
                                                                        │
                                              load_or_create_study(cfg) ▼  (load_if_exists=True)
                                                         live optuna.Study  (optuna schema, RDBStorage)
                                                                        │
                       optimization/analytics.py: compute_study_analytics(study, *, is_running)
                          • param_importances  (skip while running / < MIN_TRIALS)
                          • parallel_coordinate (from completed trials)
                          • pareto_front        (study.best_trials)
                                                                        │
        GET /api/v1/optimize/{study_id}/analytics  (state-aware; importance cached by trial count)
```

Reload mirrors `results_payload_from_db` (strip `persisted_snapshot`, `OptimizationConfig.model_validate`).
The live in-memory job (`get_job`) also carries `config`; either path yields a config to reload the
optuna study. Importance is cached keyed by `(study_id, n_complete_trials)` so polling/refetch is cheap.

### Frontend (`q_frontend`)

```
useOptimizationAnalytics(studyId, { isRunning })   ── refetchInterval while running ──▶ /analytics
        │
        ▼  new "Analytics" tab in OptimizationResultsTabs.tsx
   ┌ ParetoFrontPanel        (recharts ScatterChart, non-dominated highlighted)   [live]
   ├ ParallelCoordinatePanel (visx: d3 scales + @visx/shape LinePath)             [live]
   └ ParamImportancePanel    (recharts BarChart; pending state while running)     [end]
```

Polling stops once status is terminal (`done`/`error`/`cancelled`). Poll interval 2–3 s so live
reloads don't contend with trial workers writing the same Postgres.

## Multi-objective note

`get_param_importances` needs a single `target`; for multi-objective we compute importance **per
objective** (return, drawdown) and let the UI toggle which target to show. Pareto panel only renders
a true frontier when `is_multi_objective`; single-objective shows best-value highlight on the scatter.

## Work Orders

- [x] **WO113** — Backend: analytics service + state-aware endpoint + schema.
- [x] **WO114** — Frontend: live query + Analytics tab + Pareto + parallel coordinate.
- [x] **WO115** — Frontend: param importance panel + pending/empty states + per-target toggle.
