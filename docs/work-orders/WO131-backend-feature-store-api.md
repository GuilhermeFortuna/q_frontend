# WO131 — Backend: Feature Store API + Feature Passport payload

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md`. Depends on **WO130** (DB models + repositories). Closes
**Phase 1** — the Research Workspace frontend (later batch) consumes these endpoints.

**Principle:** expose the Feature Store as a small read-mostly API. The detail endpoint returns the
**Feature Passport** — everything about a feature in one payload (definition, provenance, versions,
status, usage; evaluation history is wired in by WO135).

## How the pieces work today (read these files)

- `src/q_backend/api/routers/optimization.py` — the router style (path, `response_model`, job-first /
  DB-fallback, 404 semantics). **Model the new router on this.**
- `src/q_backend/api/schemas/` — how response schemas are defined + exported (see
  `OptimizationResultsResponse`). **Add feature schemas the same way.**
- `src/q_backend/storage/db/repositories.py` (WO130) — `list_feature_definitions`,
  `get_feature_definition`, `set_feature_status`.
- How routers obtain a `Session` (the existing `Depends` DB-session dependency) — reuse it, don't add
  a new one.

## Goal

```
GET  /api/v1/features                      → list (Feature Store table rows)
GET  /api/v1/features/{name}               → Feature Passport (detail)
POST /api/v1/features/{name}/{version}/status   → promote/demote status
```

```jsonc
// GET /api/v1/features?category=momentum&status=production
{
  "features": [
    {
      "name": "rsi",
      "category": "momentum",
      "latest_version": 1,
      "status": "experimental",
      "usage_count": 3,
      "score": null,
    }, // score filled by WO135
  ],
}
```

```jsonc
// GET /api/v1/features/rsi  — Feature Passport
{
  "name": "rsi",
  "category": "momentum",
  "description": "…",
  "usage_count": 3,
  "versions": [
    {
      "version": 1,
      "status": "experimental",
      "node_kind": "ind.rsi",
      "param_keys": ["period"],
      "default_params": { "period": 14 },
      "forward_window": 0,
      "leakage_status": "clean",
      "provenance": { "source_wo": "WO127", "author": "registry" },
    },
  ],
  "evaluation_history": [], // populated by WO135; empty for now
}
```

## Tasks

### 1. Schemas — `api/schemas/…`

`FeatureListItem`, `FeatureListResponse`, `FeatureVersionDetail`, `FeaturePassportResponse`,
`FeatureStatusUpdateRequest` (`{ "status": "candidate" }`). Add `score` (`Optional[float]`, `null`
for now) and `evaluation_history` (`list`, empty for now) so WO135 fills them without an API shape
change. Export alongside the optimization schemas.

### 2. Router — `api/routers/features.py`

- `GET /api/v1/features` — `list_feature_definitions(session, category, status)` → `FeatureListItem`s.
  Query params `category` + `status` optional.
- `GET /api/v1/features/{name}` — `get_feature_definition`; 404 if unknown; assemble the Passport with
  versions sorted desc.
- `POST /api/v1/features/{name}/{version}/status` — validate `status ∈ FeatureStatus`,
  `set_feature_status`; 404 if the version doesn't exist; return the updated passport.
- Register the router where the others are mounted.

### 3. Status transitions

Allow any status → any status (experimental/candidate/production) — promotion is a human decision, no
state machine. **Reject** an unknown status string with 422 (let the enum validation do it).

## Guardrails

> **Read-mostly.** Only the status POST mutates, and only the `status` column. No endpoint recomputes
> features, triggers matrix builds, or writes provenance.
> **Passport is one round-trip.** The detail endpoint returns everything for a feature in a single
> payload — no N+1 of follow-up calls for versions.
> **Forward-compatible.** `score` + `evaluation_history` exist now as null/empty so WO135 needs no
> schema migration.

## Tests

- `tests/api/test_features_api.py` (seed via `sync_registry_to_db` in a fixture):
  - `GET /features` returns the seeded catalog; `?category=` and `?status=` filter.
  - `GET /features/rsi` returns a Passport with the v1 version block, `leakage_status: "clean"`,
    `forward_window: 0`, `score: null`, `evaluation_history: []`.
  - `GET /features/does-not-exist` → 404.
  - `POST /features/rsi/1/status {"status":"production"}` flips status; a re-GET reflects it; an
    invalid status → 422.

## Docs

- `docs/design/feature-intelligence.md`: tick Phase 1 complete; list the three endpoints.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the exact `GET /api/v1/features/rsi` Passport JSON, and confirmation the
  status POST round-trips.

## Out of scope

- Any frontend (Feature Store table / Passport UI) — later batch.
- Evaluation metrics, leaderboard, scores — **WO132–135** (this endpoint's `score`/`evaluation_history`
  stay null/empty until WO135).
