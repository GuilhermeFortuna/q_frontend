# WO166 — Backend/frontend: honest inconclusive experiment verdict semantics

## Shared context (read first)

This is an independent correctness follow-up to WO154/WO156 and should land before WO164/WO165. The
stored Discovery A/B report can currently complete with zero surviving paired seeds and label the
result `no_effect`. Statistically, zero observations are not evidence of no effect. This WO fixes the
shared contract and all existing consumers without waiting for the larger alpha-research experiment.

Backend uses `uv`; frontend uses `pnpm`.

## Files to read

- `q_backend/src/q_backend/api/discovery_ab_jobs.py`
- `q_backend/src/q_backend/api/schemas/experiments.py`
- `q_backend/tests/api/test_discovery_ab_jobs.py`
- `q_frontend/src/types/experiments.ts`
- `q_frontend/src/components/research/experiments/DiscoveryAbPanel.tsx`
- `q_frontend/src/components/research/experiments/__tests__/DiscoveryAbPanel.test.tsx`
- `q_frontend/src/mocks/experiments.ts`
- `q_frontend/docs/design/discovery-payoff-validation.md`

## Goal

Distinguish insufficient evidence from a measured non-significant effect:

```text
helps | no_effect | hurts | inconclusive
```

- `inconclusive`: fewer than the configured minimum complete paired seeds.
- `no_effect`: enough complete pairs were measured, but the effect did not clear the declared
  significance/effect criteria.

## Tasks

1. Add an additive `inconclusive` verdict and `minimum_complete_pairs` request/default contract. Use a
   conservative default of at least 2 complete pairs; expose `requested_seeds`, `complete_pairs`, and
   dropped-pair reasons in the result.
2. Change `_build_result`/verdict computation so insufficient complete pairs returns `inconclusive`.
   Do not synthesize zero means, zero effect size, or `p_value=1` as if those were observations. Make
   statistics nullable when they cannot be computed.
3. Preserve old stored reports during deserialization. An old `no_effect` report remains readable;
   do not rewrite historical artifacts silently. New reports use the corrected contract.
4. Update `DiscoveryAbPanel` types, badge/copy, stat rendering, chart empty state, and details. The
   panel must show `INCONCLUSIVE — INSUFFICIENT COMPLETE PAIRS`, the completed/requested count, and
   dropped-run reasons without formatting nullable statistics.
5. Update MSW fixtures and tests for completed evidence, partial-but-sufficient evidence, zero pairs,
   one pair, failed/cancelled children, and legacy stored payloads.
6. Update `docs/design/discovery-payoff-validation.md` with the corrected semantics and migration
   behavior. Cross-link WO164 as a consumer of the shared rule, not its owner.

## Guardrails

- Zero samples are never `no_effect`.
- `no_effect` remains available for adequately sampled non-significant results.
- Old artifacts remain readable; avoid a destructive data migration.
- Backend and frontend contract changes land together.
- Do not add alpha-research orchestration or UI in this WO.

## Tests

- Backend: zero/one complete pairs -> `inconclusive`; sufficient pairs -> normal three-way verdict;
  nullable statistics serialize; legacy `no_effect` payload reads successfully.
- Frontend: inconclusive badge/copy, no `NaN`/`.toFixed()` crash, dropped reasons visible, legacy
  `no_effect` still renders.
- Run:

```bash
cd q_backend && uv run pytest tests/api/test_discovery_ab_jobs.py
cd q_frontend && pnpm test:run src/components/research/experiments/__tests__/DiscoveryAbPanel.test.tsx
cd q_frontend && pnpm typecheck && pnpm build
```

## Definition of done

All new and existing experiment consumers distinguish missing evidence from measured no-effect
evidence, and old stored reports remain readable.

## Out of scope

Alpha-research orchestration (WO164), Alpha Research UI (WO165), rerunning cancelled historical jobs,
and changing encoder-ablation gate semantics.
