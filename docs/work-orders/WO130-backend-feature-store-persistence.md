# WO130 — Backend: Feature Store persistence (DB models + repositories + migration)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md`. Depends on **WO127** (registry is the source of the v1
catalog rows). WO131 (API) and WO135 (scores) read/write these tables.

**Principle:** the registry (WO127) is the _code_ catalog; this WO is the _database of record_ — every
feature definition + version with status, provenance, and usage count, so a feature is a tracked,
queryable asset (the Feature Passport's backing store).

## How the pieces work today (read these files)

- `src/q_backend/storage/db/models.py` — `Base`, `UUIDPrimaryKeyMixin`, `TimestampMixin`,
  `PortableJSON`, and the `DatasetType`/`RunStatus` enum pattern. **Mirror these mixins + the
  `__table_args__`/`Index` style exactly** (see `StrategySearchRun`/`StrategySearchCandidate`).
- `src/q_backend/storage/db/repositories.py` — the function-style repo pattern
  (`create_*`, `get_*`, `list_*`, `update_*` taking a `Session`). **Add feature repo functions in the
  same style — no new ORM session abstraction.**
- `alembic/` (`alembic.ini`, `alembic/versions/`, `alembic/env.py`) — migration setup. **Add one new
  revision; do not edit existing revisions.**
- `src/q_backend/features/registry.py` (WO127) — `list_feature_specs()` is the seed source.

## Goal

Two tables: a feature definition (name + category) and its versions (recipe + status + provenance),
plus a usage counter incremented when a strategy/discovery run references a feature.

## Tasks

### 1. Models — `storage/db/models.py`

Add (following the existing mixins + `PortableJSON`):

```python
class FeatureStatus(str, Enum):
    EXPERIMENTAL = "experimental"
    CANDIDATE = "candidate"
    PRODUCTION = "production"

class FeatureDefinition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "feature_definitions"
    name: Mapped[str]                      # unique, == FeatureSpec.name
    category: Mapped[str]
    description: Mapped[Optional[str]]
    usage_count: Mapped[int]               # default 0
    # UniqueConstraint(name); Index on category

class FeatureVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "feature_versions"
    definition_id: Mapped[uuid.UUID]       # FK -> feature_definitions, ondelete CASCADE
    version: Mapped[int]                   # == FeatureSpec.version
    status: Mapped[str]                    # FeatureStatus, default EXPERIMENTAL
    node_kind: Mapped[str]
    param_keys: Mapped[list[str]]          # PortableJSON
    default_params: Mapped[dict]           # PortableJSON
    forward_window: Mapped[int]            # 0 for features
    leakage_status: Mapped[str]
    provenance: Mapped[dict]               # PortableJSON: author/model, source WO, created context
    # UniqueConstraint(definition_id, version)
```

### 2. Repositories — `storage/db/repositories.py`

- `upsert_feature_definition(session, *, name, category, description) -> FeatureDefinition`.
- `upsert_feature_version(session, *, definition_id, version, status, node_kind, param_keys,
default_params, forward_window, leakage_status, provenance) -> FeatureVersion`.
- `get_feature_definition(session, name) -> Optional[FeatureDefinition]` (with versions loaded).
- `list_feature_definitions(session, *, category=None, status=None) -> list[...]`.
- `set_feature_status(session, *, name, version, status)`.
- `increment_feature_usage(session, *, name, n=1)` — bumps `usage_count` atomically.

### 3. Seeding — `src/q_backend/features/sync.py`

`sync_registry_to_db(session)`: for every `FeatureSpec` from `list_feature_specs()`, upsert its
definition + version. **Idempotent** — running twice changes nothing. Status defaults to
`EXPERIMENTAL`; never downgrade a status already set in the DB (a human-promoted PRODUCTION feature
stays PRODUCTION across syncs). Provenance records `{"source_wo": "WO127", "author": "registry"}`.

### 4. Migration

One new Alembic revision under `alembic/versions/` creating both tables + indexes + constraints.
Down-revision = current head. **Do not edit existing revisions.**

## Guardrails

> **Registry is the recipe source; DB is the record.** `sync_registry_to_db` is one-way
> (code → DB) and idempotent. It seeds and updates recipe fields but **never overwrites a
> human-set `status`** downward.
> **Migration only adds.** New tables, no changes to existing ones. Down-revision chained to head.
> **No compute here.** This WO is persistence only — it imports the registry for metadata, not the
> compute/matrix modules.

## Tests

- `tests/features/test_feature_store_db.py` (use the existing test DB/session fixture pattern from
  `tests/` — match how `repositories` tests get a `Session`):
  - `sync_registry_to_db` creates one definition per spec name and one version row each; running it
    twice is a no-op (counts unchanged, no duplicate-key error).
  - `set_feature_status(name, 1, PRODUCTION)` then re-sync keeps it PRODUCTION.
  - `increment_feature_usage` raises `usage_count`; `list_feature_definitions(category=…)` filters.
- Migration smoke: `alembic upgrade head` then `downgrade -1` runs clean against the test DB (mirror
  any existing migration test; if none exists, an upgrade-head check in the fixture is enough).

## Docs

- `docs/design/feature-intelligence.md`: tick persistence landed; note the one-way idempotent sync.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the row count after `sync_registry_to_db` (definitions + versions) and
  confirmation a second sync is a no-op.

## Out of scope

- HTTP endpoints / Feature Passport payload — **WO131**.
- Evaluation scores attached to versions — **WO135**.
