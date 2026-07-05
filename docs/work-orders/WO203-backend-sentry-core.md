# WO203 — Backend: Sentry core (config-driven init, scrubbing, trading context)

## Shared context (read first)

First of the **WO203–WO206 Sentry batch** (observability for the whole platform, per the
approved integration plan). Execution sequence: `203 → 204` serial (WO204 consumes this WO's
init module and tag helper, same repo) · **WO205 may run in parallel with 203/204** (frontend
repo, no shared contract) · `206 strictly last` (stamps both builds + runbook).

Facts that shape this WO: `sentry-sdk>=2.64.0` is **already declared** in
`q_backend/pyproject.toml` but never imported — this WO wires it, it does not add it. The
platform is a single-user trading app reporting to **Sentry SaaS**, so privacy is a design
constraint, not an afterthought: everything ships **dormant** (no DSN committed; enabled only
when `SENTRY_DSN` is present in the environment), `send_default_pii=False`, and an event
scrubber guarantees AI-builder prompts and strategy descriptions never leave the machine.

Two-repo project: backend `q_backend` uses `uv` (`uv run pytest` — never pip/poetry);
frontend `q_frontend` uses `pnpm` (never npm). Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `q_backend/src/q_backend/api/main.py` + `api/lifespan.py` — app factory and startup
  lifespan (where init hooks in; note WO convention: every callable must name its
  production trigger — here it's app startup)
- `q_backend/src/q_backend/storage/settings.py` — pydantic `Settings`
  (`BaseSettings`/`SettingsConfigDict`); follow existing naming (`Q_*` env prefix pattern —
  check how existing vars map before naming the Sentry ones)
- `q_backend/pyproject.toml` — `sentry-sdk>=2.64.0` already present
- `q_backend/.env.example` — where the new vars get documented
- `q_backend/src/q_backend/strategy_builder/` — the request/response models whose free-text
  fields (prompts, conversation, spec descriptions) must be scrubbed from events

## Goal

```python
# src/q_backend/observability/sentry.py (new module)
def init_sentry(settings: Settings, *, component: str) -> bool:
    """Idempotent. No-op (returns False) unless settings.sentry_dsn is set.
    component ∈ {"api", "worker", "cli"} — becomes the `component` tag."""

def trading_context(**tags) -> AbstractContextManager[None]:
    """Scoped tags for trading work: symbol, strategy, backtest_id, study_id,
    dataset, worker_id — only IDs and symbols, never free text."""
```

Sentry live on the API process with FastAPI + SQLAlchemy integrations, sane sampling,
scrubbed events, and a reusable tag helper — all inert until a DSN exists.

## Tasks

1. **Settings.** Add to `Settings`: `sentry_dsn: str = ""`, `sentry_environment: str`
   (default `"local"`), `sentry_traces_sample_rate: float = 0.2`,
   `sentry_profiles_sample_rate: float = 0.1` — env var names following the file's existing
   prefix convention. Document all four in `.env.example`, commented out, with a pointer to
   the WO206 runbook.
2. **`observability/sentry.py`** (new package) per the Goal signatures:
   - `init_sentry`: no-op without DSN; `sentry_sdk.init` with `FastApiIntegration`,
     `StarletteIntegration`, `SqlalchemyIntegration`; `send_default_pii=False`;
     `environment`, sample rates from settings; `release` read from env
     (`Q_RELEASE`/git SHA — WO206 wires the stamping; absent is fine); sets tags
     `component`, `python_version`, `os`. Idempotent (second call returns early).
   - **`before_send` scrubber**: drop/redact free-text trading content — any event payload
     fields named `prompt`, `message`, `conversation`, `description`, `content` under
     request bodies for `/strategy-builder/*` routes are replaced with `"[redacted]"`;
     request bodies beyond form/JSON keys are never attached (`max_request_body_size="never"`
     or the SDK's equivalent — verify the current option name against the installed SDK).
   - `trading_context(**tags)`: context manager pushing a Sentry scope with the allowed tag
     keys only (`symbol`, `strategy`, `backtest_id`, `study_id`, `dataset`, `worker_id`);
     unknown keys raise `ValueError` in tests/dev (fail loud, so free text can't sneak in
     via a typo'd kwarg).
3. **Wire startup.** Call `init_sentry(get_settings(), component="api")` at the top of the
   lifespan (before other startup work so their failures are captured). Production trigger:
   app startup — nothing else to wire.
4. **Route context.** Tag obvious hot routes where ids are already in hand (backtests run,
   optimization start, discovery start): wrap the handler body's job-submission section in
   `trading_context(...)` with the ids the route already has. Keep it to the 3–5 routes
   where a Sentry event without these tags would be ambiguous — this is seasoning, not a
   sweep.
5. **Startup log line.** One INFO log: `sentry: enabled env=<env> traces=<rate>` or
   `sentry: disabled (no DSN)` — so it's always obvious which mode the process is in.

## Guardrails

> **Dormant by default**: no DSN in any committed file; with `SENTRY_DSN` unset the module
> must add zero overhead and make zero network calls (assert in tests via transport mock).
> **Privacy floor**: `send_default_pii=False`; no request bodies; the scrubber list is a
> deny-by-redaction on named fields — when in doubt, redact. Tags carry IDs/symbols only.
> **Never break the app**: `init_sentry` wraps its body so an SDK/config error logs a
> warning and continues — observability must not take down trading.
> **No new dependencies** — the SDK is already declared; do not bump its pin.
> **Determinism**: sampling rates come from settings; no hardcoded rates outside defaults.

## Tests

New `q_backend/tests/observability/test_sentry.py`:

- no DSN → `init_sentry` returns False, `sentry_sdk.Hub`/client not configured;
- DSN set (fake) with a mock transport → init succeeds, event captured via
  `capture_exception` carries `component` tag and `environment`;
- scrubber: a synthetic event containing a `/strategy-builder/interpret` request with
  `prompt`/`conversation` fields → fields `"[redacted]"`; unrelated fields intact;
- `trading_context(symbol="WIN$", study_id="abc")` → tags on captured event; unknown kwarg
  → `ValueError`;
- idempotency: double init doesn't reconfigure or warn twice.

## Docs

Module docstring covers the privacy model. `.env.example` comments (Task 1). The full
operator-facing doc lands in WO206's runbook — reference it, don't duplicate.

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must
include: the settings fields as shipped, the scrubber's redaction field list, the routes
that gained `trading_context`, and the startup log line from a local run in both modes
(DSN unset / fake DSN). Production trigger: API lifespan (named in Task 3).

## Out of scope

Dramatiq/CLI wiring (WO204); frontend/Tauri (WO205); release stamping and the Sentry-UI
runbook (WO206); custom performance spans beyond the SDK integrations' defaults; alert
configuration.
