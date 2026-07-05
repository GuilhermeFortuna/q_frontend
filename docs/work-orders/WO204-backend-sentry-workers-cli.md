# WO204 — Backend: Sentry for Dramatiq workers and CLI tools

## Shared context (read first)

Second of the **WO203–WO206 Sentry batch**. Execution sequence: `203 → 204` serial — this WO
consumes WO203's `observability/sentry.py` (`init_sentry`, `trading_context`) · WO205 runs in
parallel in the frontend repo · 206 last.

The worker pool is where the platform's heavy work fails: backtests, Optuna trial batches,
walk-forward windows, discovery candidates all drain through Dramatiq actors
(`q_backend/src/q_backend/tasks/`). Today a crashed actor is a log line in a terminal the
user may not be watching. This WO initializes Sentry in the worker process and CLI entry
points and attaches trading tags per message — using the SDK's `DramatiqIntegration`, not
the hand-rolled try/except the original plan sketched.

Backend repo: `q_backend`, `uv` (`uv run pytest` — never pip/poetry). Paths relative to
`C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `q_backend/src/q_backend/tasks/broker.py` — importing sets the global Redis broker;
  existing custom `Middleware` subclass and `worker_context` shutdown hook show the
  middleware pattern to follow
- `q_backend/src/q_backend/tasks/actors.py` — the actor definitions and their message
  payloads (which ids each actor receives: study/backtest/discovery ids, symbols)
- `q_backend/src/q_backend/cli/worker.py` — worker launcher (`main()`)
- `q_backend/src/q_backend/cli/q_optimize.py`, `q_execution.py`, `q_train_encoder.py`,
  `q_promote_encoder.py` — argparse CLIs with `main(argv) -> int`
- `q_backend/src/q_backend/observability/sentry.py` — WO203's module (init, allowed tag
  keys)
- sentry-sdk's Dramatiq support: verify how the installed SDK version exposes it
  (`sentry_sdk.integrations.dramatiq.DramatiqIntegration`) and what it captures
  (actor failures incl. final-retry semantics) — read the integration source in the venv,
  don't assume

## Goal

Every actor failure and CLI crash lands in Sentry tagged `component=worker|cli`, with the
message's trading ids as tags and retry visibility from the integration — still fully
dormant without a DSN.

## Tasks

1. **Worker init.** In `broker.py` (module import is the worker's real entry — the API
   process imports it too, so guard: only init with `component="worker"` when running under
   the dramatiq worker; the launcher `cli/worker.py:main()` is the right hook — call
   `init_sentry(get_settings(), component="worker")` there, passing `DramatiqIntegration`
   through (extend `init_sentry` with an `extra_integrations` parameter rather than a
   second init path).
2. **Per-message tags.** A small Dramatiq `Middleware` (pattern-match the existing one in
   `broker.py`): `before_process_message` opens a `trading_context` scope from recognized
   message kwargs (`study_id`, `backtest_id`, `symbol`, … — map from what `actors.py`
   actually passes), plus `actor=<actor_name>` and `worker_id`; `after_process_message` /
   `after_skip_message` closes it. Only the WO203 allowed keys — ignore everything else in
   the payload.
3. **Retry visibility.** Confirm what `DramatiqIntegration` reports on retries vs final
   failure with the broker's current retry settings; if intermediate retries produce noise
   (an event per attempt), configure to capture on final failure only, with the attempt
   count as a tag. Document the choice in the module docstring.
4. **CLI init.** Each `cli/*.py` `main()` calls `init_sentry(settings, component="cli")`
   first thing, plus `sentry_sdk.set_tag("cli_command", "<name>")`; unhandled exceptions
   propagate as today (the SDK's atexit flush handles delivery — do not add try/except
   wrappers that change exit codes).
5. **Flush on worker shutdown.** Follow the existing `shutdown_worker_market_data` hook:
   ensure `sentry_sdk.flush(timeout=2)` runs on worker stop so buffered events aren't lost
   with the process.

## Guardrails

> **Dormant without DSN** — the middleware must be cheap no-ops when Sentry is disabled
> (check once at construction, not per message).
> **Never change job semantics**: no swallowed exceptions, no altered retry behavior, no
> changed exit codes — Sentry observes, it does not participate.
> **API process unaffected**: importing `broker.py` from the API must not re-init Sentry as
> `worker` (WO203's `component="api"` init stands; idempotent init protects this — test it).
> **Tag discipline**: only WO203's allowed keys + `actor`/`cli_command`; message payloads
> may contain full strategy specs — never attach the payload itself.

## Tests

Extend `q_backend/tests/` (mirror where existing tasks/broker tests live; add
`tests/observability/test_sentry_worker.py`):

- middleware with Sentry disabled → no scope pushes, no overhead calls;
- fake-DSN + mock transport: actor raising → event with `component=worker`, `actor`,
  `study_id` tags; message without recognized ids → event still delivered, no crash;
- retry semantics per Task 3's decision (single event on final failure, attempt tag);
- CLI: `q_optimize.main` with induced error → event tagged `cli_command=q_optimize`, exit
  code unchanged vs today;
- double-init guard: broker import after API init keeps `component=api`.

## Docs

Worker section in the module docstrings; one paragraph added to the backend dev docs where
the worker launch command is documented (that Sentry activates with the same `SENTRY_DSN`
env as the API).

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must
include: the middleware class as shipped, the retry-capture decision with its rationale,
the list of CLI entry points wired, and the tag set observed on a captured test event.
Production triggers: `cli/worker.py:main()` (worker), each CLI `main()` — named per Task
1/4.

## Out of scope

API-side init (WO203); frontend/Tauri (WO205); release stamping/runbook (WO206); adding
performance spans inside actors (follow-up if the default integration tracing proves
insufficient); changing broker/retry configuration.
