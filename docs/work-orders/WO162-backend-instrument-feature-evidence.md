# WO162 — Backend: instrument-specific feature evidence and admission

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md`. Depends on WO159/WO160 and the profile
contract from WO161. This WO supersedes WO45's standalone feature-miner design by building on the
implemented Feature Store/evaluation/scoring stack from WO127-WO141.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO158-WO161 completion messages
- `src/q_backend/features/registry.py`
- `src/q_backend/features/targets.py`
- `src/q_backend/features/evaluation.py`
- `src/q_backend/features/scoring.py`
- `src/q_backend/features/evaluation_service.py`
- `src/q_backend/storage/db/repositories.py`
- `src/q_backend/storage/lake/artifacts.py`
- `src/q_backend/optimization/dsr.py`
- `tests/features/`

## Goal

Decide which causal features contain repeatable information for each instrument/horizon before those
features enter hypothesis templates or GA seeding.

Introduce a versioned `FeatureEvidence` result keyed by:

```text
(profile_id, profile_version, feature_id, feature_version, target, horizon, split_manifest_hash)
```

It records raw IC/rank IC/MI, purged-fold statistics, sign consistency, regime breakdown, redundancy,
permutation null floor, deflated score, decision, and rejection reasons.

## Tasks

1. Add profile-aware target definitions for the horizons in the design doc. Labels are computed only
   inside the feature-evidence segment and use purge/embargo widths at least as large as the forward
   horizon.
2. Extend the current evaluator with deterministic chronological folds and explicit purge/embargo.
   Record IC and rank-IC per fold, sign consistency, median effect, dispersion, and sample count.
3. Add block-permutation calibration using the same number of attempted feature/horizon combinations.
   `deflated_score` must fall when the search budget increases with observed performance fixed.
4. Use the existing redundancy/correlation machinery to admit distinct information rather than many
   aliases of momentum or trend.
5. Add profile-owned admission thresholds and structured decisions:
   `admitted | rejected | inconclusive`. Insufficient samples, missing folds, or failed data preflight
   are `inconclusive`, never zero-effect evidence.
6. Persist full fold/null diagnostics to the lake and compact evidence summaries to the existing
   database/API structures. Include source-data fingerprints and split manifest.
7. Implement WO161's `FeatureAdmissionResolver` with an internal evidence query and wire it into
   `HypothesisCandidateProvider`. Return only admitted evidence matching the exact profile version,
   feature version, horizon, and data fingerprint. Add an integration test proving admitted evidence
   makes a hypothesis eligible while rejected, inconclusive, missing, or mismatched evidence keeps it
   ineligible. WO164 consumes the same resolver; no parallel eligibility path is allowed.

## Guardrails

- Feature selection sees only the early feature-evidence segment.
- Do not tune admission thresholds by inspecting walk-forward or lock-box outcomes.
- Block permutation preserves local autocorrelation structure; row-wise shuffling is not acceptable.
- A high aggregate IC with unstable sign across folds is rejected.
- Neural latents compete under the same evidence contract; no privileged threshold.
- No automatic promotion to PRODUCTION neural status.
- No broad combinatorial feature mining in v1. Evaluate the registered/context features required by
  the curated catalog plus a bounded, recorded candidate list.
- This WO replaces WO161's fail-closed runtime resolver with the real query. The admitted-all stub
  remains test-only and is not imported by production code.

## Tests

- Planted causal feature clears admission; planted lookahead feature fails leakage/purge checks.
- One-fold-only signal fails sign/stability admission despite high aggregate IC.
- Duplicated/correlated feature is rejected by redundancy logic.
- Increasing attempted-feature count raises the null floor and reduces the deflated score.
- Too-short ranges produce `inconclusive`, not `rejected` or `admitted`.
- Split-date assertions prove evidence, walk-forward, and lock-box ranges are disjoint.
- Persistence round-trip retains profile/version/horizon/fingerprint and fold/null diagnostics.
- Run all feature, neural-gate, storage, and strategy-search integration tests, then full
  `uv run pytest`.

## Docs

Record the final `FeatureEvidence` schema and profile thresholds in the design doc.

## Definition of done

The system can state, with reproducible diagnostics, which available features are admissible for each
instrument and horizon before strategy search begins.

## Out of scope

Hypothesis definitions (WO161), strategy-level robustness (WO163), UI, unbounded feature generation,
and lock-box evaluation.
