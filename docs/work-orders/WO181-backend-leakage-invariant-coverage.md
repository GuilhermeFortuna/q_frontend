# WO181 — Backend: close the leakage-invariant coverage gaps

## Shared context (read first)

Part of the WO177–WO182 hardening batch (no new features). Two good causality harnesses already
exist; the hardening gap is what they _exclude_. Exclusions today are silent filters inside test
files, so every new feature source added since (neural latents, exogenous specs, new node families)
quietly fell outside the invariant. A lookahead bug in any of these produces beautiful backtests
and dead paper strategies — the exact failure the evaluation-realism work is trying to prevent.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest`).

## Files to read

- `src/q_backend/features/leakage.py` (`assert_causal`, `FORWARD_LOOKING_KINDS` — note it is empty)
- `tests/features/test_leakage.py` — `test_assert_causal_passes_for_v1_specs` filters out
  `spec.source == "neural"` and `spec.category == "exogenous"`
- `tests/backtesting/genome/test_context_features.py` — `test_prefix_causality` covers only
  `feature.*` node kinds (22 of the node registry)
- `src/q_backend/backtesting/genome/node_specs.py`, `feature_nodes.py`, `latent_universe.py`
- `src/q_backend/features/targets.py` and `tests/features/test_targets.py`
- `src/q_backend/features/registry.py` (`list_feature_specs`, `register_neural_model_features`)

## Goal

Every computable feature source in the system is covered by a causality invariant, and every
exemption is an explicit, reviewed list that fails the suite when it drifts:

```python
# tests/leakage_exemptions.py — the ONLY place exclusions may live
EXEMPT_SPECS: dict[str, str] = {
    # "spec_name": "reason this cannot leak / why exempt (reviewed WO181)",
}
```

## Tasks

1. Convert both harnesses' silent filters into assertion-backed exemption lists: the parametrized
   causal tests enumerate _everything_ (`list_feature_specs()` with no source/category filter; all
   `NODE_SPECS` kinds, not just `feature.*`), skip only names present in the exemption dict, and a
   companion test fails if the dict names anything that no longer exists or if a spec is neither
   tested nor exempted.
2. Bring neural specs under the invariant: using the PCA encoder path (no torch requirement in CI),
   run `assert_causal` with the `train_end` OOS-only semantics on a registered neural model's
   latent features, and the same for latent genome nodes from `latent_universe.py` inside a
   CompositeStrategy prefix-causality test.
3. Bring exogenous-category specs under the invariant or into the exemption dict with a stated
   reason per spec (exogenous data timing is exactly where lookahead usually hides — "published-at
   vs effective-at"; verify each spec's alignment uses publish time).
4. Cover the remaining genome node families (indicator nodes, operators, normalization nodes) with
   `test_prefix_causality`-style checks: full-frame vs prefix-frame values must agree on the prefix
   for every kind in `NODE_SPECS`.
5. Targets are the other half of PIT: add tests in `tests/features/test_targets.py` asserting each
   target in `targets.py` at bar t uses only bars strictly after t up to its stated horizon
   (forward-looking by contract) and that target rows within `horizon` of `train_end` are excluded
   from training-eligible masks (no boundary bleed through the split manifest).

## Guardrails

> This WO adds tests and exemption structure; production feature code changes only when a test
> exposes a real leak. If one is found: fix it if unambiguous, otherwise exempt it with a
> `LEAK-CONFIRMED` reason and report it prominently — do not silently re-filter it.
> Synthetic data only, fixed seeds, no torch dependency in the new tests (PCA path).
> Do not weaken `assert_causal` tolerances to make a spec pass.

## Tests

This WO is tests. Additionally: a meta-test asserting exemption-dict hygiene (Task 1), and a
deliberately leaky fixture spec (shift(-1)) proving each extended harness still catches leaks
end-to-end.

## Docs

Section in `q_backend/README.md` or `docs/` feature docs: "Causality invariants — what is covered,
how to exempt, and why exemptions need a reason."

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must include: the
final exemption dict with reasons, and any confirmed leaks found (spec/node name, mechanism, fix or
exemption).

## Out of scope

Golden output pinning (WO180). Discovery pipeline smoke (WO182). New features or targets. Fixing
statistical-power issues in evaluation (separate track).
