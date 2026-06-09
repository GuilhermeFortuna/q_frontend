# Phase A — Wire Persistence · Work Orders

These are self-contained task prompts to hand to coding agents. Each file includes its
own shared-context header, so an agent can act on one file with no other knowledge of
the project.

## Goal of Phase A

The backend has a fully-written persistence layer (`src/q_backend/storage/db/`) —
SQLAlchemy models, an Alembic migration, and a `repositories.py` of `create_*`/`update_*`
functions — but the API never imports any of it. Backtests and Optuna studies run
ephemerally and vanish on restart. Phase A **wires the existing persistence in** (it is
mostly plumbing, not new design) and surfaces run/study history in the UI.

## Work orders

| #   | File                                                                               | Repo       | Depends on                   |
| --- | ---------------------------------------------------------------------------------- | ---------- | ---------------------------- |
| 1   | [WO1-backend-backtest-persistence.md](WO1-backend-backtest-persistence.md)         | q_backend  | —                            |
| 2   | [WO2-frontend-backtest-history.md](WO2-frontend-backtest-history.md)               | q_frontend | WO1 contract                 |
| 3   | [WO3-backend-optimization-persistence.md](WO3-backend-optimization-persistence.md) | q_backend  | WO1 (deps.py, repo patterns) |
| 4   | [WO4-frontend-optimization-history.md](WO4-frontend-optimization-history.md)       | q_frontend | WO3 contract                 |

## Dispatch order

```
WO1  ──►  WO2  ┐
          WO3  ┴──►  WO4
```

WO1 first. Once it merges, WO2 and WO3 can run **in parallel** (both depend only on
WO1's `deps.py` + endpoint contracts). WO4 last, after WO3's contract is final.

## Review checklist (apply to every returned PR)

1. Does the compute path still work with Postgres **stopped**? (stop the container, run a backtest / a study)
2. Are new id fields (`run_id`, `study_id`) strictly **additive** — did any existing response field change shape?
3. Did anything sneak **trades / bars / indicator series into Postgres**? (must not — that's a later data-lake phase)
4. Did background threads use `session_scope()` and **not** a request-scoped session?
5. Did the agent actually **run the stated verification command**, or just claim green?
