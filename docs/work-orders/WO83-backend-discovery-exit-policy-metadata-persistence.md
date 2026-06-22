# WO83 — Backend: persist genetic Discovery exit-policy metadata

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** WO80 added genome-level exit policies and metadata such as
`exit_policy_id`, `exit_policy_label`, `exit_param_names`, and `last_exit_mutation_op`. WO82 renders
those labels in Discover. A review found that the live in-process genetic path records the metadata,
but the distributed candidate worker and DB rebuild paths drop part of it. The result is that exit
strategies can disappear from the Trade Discovery UI after a real worker run, reload, or history read.

This WO is backend-only and additive. It fixes persistence and serialization reliability for existing
WO80 fields; it must not change ranking, candidate ids, or genome semantics.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/exit_rule_policy.py`
  - `exit_policy_metadata_for_genome(genome)` returns the canonical genetic exit-policy metadata.
- `src/q_backend/optimization/genetic_search.py`
  - in-process `_record_candidate_metadata` already merges `exit_policy_metadata_for_genome`.
- `src/q_backend/api/strategy_search_jobs.py`
  - distributed `run_genetic_candidate`, `_dispatch_generation` pre-screen metadata, `_finalize_genetic`,
    `_persist_run_finish`, `_serialize_candidate`, `_serialize_db_candidate`, DB-backed payload rebuild.
- `src/q_backend/storage/db/models.py`
  - `StrategySearchCandidate` nullable columns.
- `src/q_backend/storage/db/repositories.py`
  - `create_strategy_search_candidate`.
- Existing migrations under `alembic/versions/`.
- Tests to read/extend:
  - `tests/api/test_strategy_search_persistence.py`
  - `tests/backtesting/test_genome_exit_policy.py`
  - `tests/optimization/test_strategy_search.py`

---

## Review finding this fixes

Distributed genetic search drops the new exit-policy metadata:

- `run_genetic_candidate` stashes only generation/genome/node/complexity metadata.
- The generation pre-screen path stashes the same reduced shape.
- `_finalize_genetic` trusts staged metadata, so missing fields never reach `_serialize_candidate`.
- `StrategySearchCandidate` and `create_strategy_search_candidate` have `exit_preset_*` columns but no
  `exit_policy_*` fields.
- `_serialize_db_candidate` cannot emit genetic exit policy labels after a DB reload.

## Goal

Every genetic candidate with an exit policy has the same exit-policy metadata in all result paths:

```json
{
  "exit_policy_id": "atr_stop_chandelier",
  "exit_policy_label": "ATR stop + Chandelier trail",
  "exit_param_names": ["exit_stop_loss_atr", "exit_atr_period", "exit_chandelier_atr_mult"],
  "last_exit_mutation_op": "swap_exit_policy"
}
```

The metadata must survive:

- live in-memory result serialization,
- distributed worker staging/finalization,
- persisted DB candidate rows,
- DB-backed result reload after process restart,
- old rows where the new columns are absent/null.

## Tasks

### 1. Add the missing metadata at distributed staging points

In `api/strategy_search_jobs.py`, merge `exit_policy_metadata_for_genome(genome)` into every staged
genetic candidate metadata payload:

- normal `run_genetic_candidate` success/error/no-result path,
- `_dispatch_generation` pre-screened no-result path.

Use the helper from `backtesting/genome/exit_rule_policy.py` as the source of truth. Do not duplicate
label logic or preset-id special cases in `strategy_search_jobs.py`.

### 2. Persist additive DB fields

Add nullable columns to `StrategySearchCandidate`:

```python
exit_policy_id: str | None
exit_policy_label: str | None
last_exit_mutation_op: str | None
```

`exit_param_names` already exists for preset metadata and can be reused for policy params unless a
clear existing constraint prevents it.

Add an Alembic migration with nullable columns only. Existing rows must remain valid.

### 3. Thread repository and persistence calls

Update:

- `create_strategy_search_candidate(...)` signature and model construction,
- `_persist_run_finish(...)` candidate persistence,
- `_serialize_db_candidate(...)`.

Preserve the existing `exit_preset_*` fields for registry candidates. Genetic candidates should emit
`exit_policy_*`; registry preset candidates should emit `exit_preset_*`; both may share
`exit_param_names`.

### 4. Keep API schemas additive

Confirm `api/schemas/strategy_search.py` and task serialization include the optional fields:

- `exit_policy_id`
- `exit_policy_label`
- `last_exit_mutation_op`
- `exit_param_names` if the response schema models it explicitly.

Missing fields must still be accepted for old cached/lake payloads.

## Guardrails

> **No ranking change.** This is persistence/serialization only. Candidate ranking, objective values,
> gates, DSR, and lock-box calculations must not change.

> **One metadata source.** Use `exit_policy_metadata_for_genome`; do not invent a second policy-label
> resolver.

> **Old rows work.** DB-backed serialization must not crash or change behavior when new columns are
> null.

> **Registry path unchanged.** Exit preset metadata from WO79 must keep working exactly as before.

## Tests

- Distributed genetic staging:
  - a genome with an exit policy stashes `exit_policy_id`, `exit_policy_label`, `exit_param_names`, and
    `last_exit_mutation_op`;
  - a pre-screened no-result genome with an exit policy stashes the same fields.
- Persistence/API:
  - a completed genetic run persists exit policy metadata to `strategy_search_candidates`;
  - `results_payload_from_db` or the DB-backed results endpoint emits the same fields after reload;
  - an old candidate row with null policy columns still serializes.
- Regression:
  - existing registry exit-preset persistence tests still pass;
  - in-process genetic metadata tests still pass.

## Docs

`q_backend/README.md`: update the genetic Discovery section to say exit-policy metadata is persisted
and available in live and history result payloads.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- A distributed genetic candidate with an exit policy shows the same `exit_policy_*` metadata before
  and after DB reload.
- Final message must paste:
  - the DB columns added,
  - the metadata payload shape,
  - the tests that prove live/distributed/DB paths agree.

## Out of scope

- New exit-policy operators or presets.
- Frontend rendering changes.
- Exit-quality scoring or ranking changes.
