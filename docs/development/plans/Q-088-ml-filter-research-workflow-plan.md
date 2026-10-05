# Q-088 implementation plan: ML filter research workflow

> **For implementation agents:** Read the linked specification and repository instructions. Use superpowers:executing-plans when available. Launch only through `./work start Q-088 --agent <agent> --worktree` after written-plan approval and completed dependencies. Implement natively; delegation requires separate authorization.

**Goal:** Deliver the behavior and acceptance criteria in the linked specification.
**Architecture:** Typed queries and existing Research/Backtests components expose server-owned training, comparison and pinned filtering.
**Tech stack:** React 19, TypeScript, TanStack Query/Router, existing UI components, Vitest and MSW.
**Spec:** [Specification](../specs/Q-088-ml-filter-research-workflow-spec.md)
**Status:** written plan awaiting human review.

## Global constraints

- Batch 14 is research-only; original MACrossover remains compatible. No live, GPU, automatic retraining or multi-entry ML support.
- Use Q-085 generated contracts, canonical repo tooling and existing execution semantics; never hand-edit vendored/generated consumer types.
- Tests use frozen/fake sources and small CPU models; production evaluation uses actual engine reruns and immutable data.
- Follow the linked spec's exact defaults, timing, split, feature, threshold, compatibility and error rules.
- Commit only focused task changes; no push, merge or protected-branch checkout. Missing prerequisites use the documented board workflow.

## Review focus

- UTC cutoffs round-trip through Brazil display timezone.
- Model/config edits do not silently substitute a saved version.
- Threshold changes do not relabel stale comparison results.
- Reload/navigation and failed/consumed jobs remain recoverable.
- Unavailable volume, metrics and unsupported compositions have actionable accessible states.

## Ordered implementation

### 1. Add generated query and mock contracts

**Files:** Create src/api/queries/mlFilters.ts, src/mocks/mlFilters.ts and src/api/queries/**tests**/mlFilters.test.ts; update mock handler registration and CONTRACTS_REV via standard vendoring.
**Interfaces:** Typed hooks for Q-085 sources/training/models/comparisons/evaluations; durable polling stops at terminal states. MSW uses generated payload types, no independent fake schema.

- [x] Add focused failing tests: Assert request source/features/UTC boundaries/algorithms/version/threshold, terminal polling/error states, results after refresh and undefined metrics with reasons. Compare hooks preserve actual submitted threshold; lockbox retries return the existing tuple.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run src/api/queries/__tests__/mlFilters.test.ts` and confirm the new behavior is missing before implementation; do not count import/setup failures as behavioral evidence.
- [x] Implement the specified interfaces and behavior, keeping public types aligned with Q-085 and preserving the existing patterns named above.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run src/api/queries/__tests__/mlFilters.test.ts` and confirm the focused suite passes.
- [x] Commit this independently reviewable unit on the task branch with a conventional, focused message.

### 2. Build training and saved-model research flow

**Files:** Create components/research/ml-filters/MLFiltersTab.tsx, MLFilterTrainForm.tsx, MLFilterModels.tsx and colocated **tests**/MLFiltersTab.test.tsx; modify workspaces/research/ResearchWorkspace.tsx, types/features.ts and src/app/router.tsx search schema.
**Interfaces:** ML Filters tab with source query selection, feature/default validation, algorithms, explicit cutoffs, durable training job and model detail; navigate with tab=ml-filters and source_run_id.

- [x] Add focused failing tests: Test source eligibility reasons, real_volume unavailable/all-zero versus legitimate tick zeros, mandatory side, invalid split/too few classes, ordered feature payload, pending/double submit, failure and navigation/reload preserving selected/active jobs. Exchange display round-trips UTC cutoffs in Brazil timezone.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run src/components/research/ml-filters/__tests__/MLFiltersTab.test.tsx` and confirm the new behavior is missing before implementation; do not count import/setup failures as behavioral evidence.
- [x] Implement the specified interfaces and behavior, keeping public types aligned with Q-085 and preserving the existing patterns named above.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run src/components/research/ml-filters/__tests__/MLFiltersTab.test.tsx` and confirm the focused suite passes.
- [x] Commit this independently reviewable unit on the task branch with a conventional, focused message.

### 3. Compare validation and select one final evaluation

**Files:** Create MLFilterComparison.tsx and MLFilterEvaluation.tsx with **tests**/MLFilterComparison.test.tsx and MLFilterEvaluation.test.tsx.
**Interfaces:** Validation comparison uses model ids from one dataset; final evaluation submits one pinned model/threshold and displays frozen lockbox consumption/result.

- [x] Add focused failing tests: Test incompatible dataset ids, threshold changes during polling, null ROC/profit-factor copy, candidate counts versus trade count, identical evaluation retry, conflicting consumed lockbox, failure and selection frozen before dispatch. Reserved-tail results never enter validation rankings.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run src/components/research/ml-filters/__tests__/MLFilterComparison.test.tsx src/components/research/ml-filters/__tests__/MLFilterEvaluation.test.tsx` and confirm the new behavior is missing before implementation; do not count import/setup failures as behavioral evidence.
- [x] Implement the specified interfaces and behavior, keeping public types aligned with Q-085 and preserving the existing patterns named above.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run src/components/research/ml-filters/__tests__/MLFilterComparison.test.tsx src/components/research/ml-filters/__tests__/MLFilterEvaluation.test.tsx` and confirm the focused suite passes.
- [x] Commit this independently reviewable unit on the task branch with a conventional, focused message.

### 4. Integrate variant setup, launch and history restore

**Files:** Create components/backtests/setup/MLFilterConfig.tsx; modify BacktestSetupPanel.tsx, lib/backtesting/useBacktestConfig.ts, entryInstances.ts, request/history types and BacktestHistoryPanel.tsx; add tests/unit/lib/backtesting/useMLFilterConfig.test.ts and setup/**tests**/MLFilterConfig.test.tsx.
**Interfaces:** Use in Backtest transfers pinned model, baseline semantic config and valid date range; history restores ml_filter; Train ML filter opens Research with completed source id. Registry capabilities govern other workspace selectors.

- [x] Add focused failing tests: Assert exact request version/threshold, original strategy request unchanged, model switching and restored unavailable refs, incompatible edits/dates, multiple-entry controls, no silent replacement, result summary and research-only exclusions.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run tests/unit/lib/backtesting/useMLFilterConfig.test.ts src/components/backtests/setup/__tests__/MLFilterConfig.test.tsx` and confirm the new behavior is missing before implementation; do not count import/setup failures as behavioral evidence.
- [x] Implement the specified interfaces and behavior, keeping public types aligned with Q-085 and preserving the existing patterns named above.
- [x] Run `TZ=America/Sao_Paulo pnpm test:run tests/unit/lib/backtesting/useMLFilterConfig.test.ts src/components/backtests/setup/__tests__/MLFilterConfig.test.tsx` and confirm the focused suite passes.
- [x] Commit this independently reviewable unit on the task branch with a conventional, focused message.

### 5. Verify the complete browser workflow and document it

**Files:** Update README.md and existing browser/MSW verification fixtures where available; no new desktop or service-launch ownership.
**Interfaces:** Source → train three algorithms → compare validation → freeze final selection → use saved model in backtest → restore history; keyboard-labelled controls, honest errors and artifact/version metadata.

- [x] Add focused failing tests: Browser/MSW review covers successful flow, empty/incompatible source, failed training, missing model, volume readiness, undefined metrics and consumed lockbox. Inspect screenshots at the existing desktop layout plus a narrower browser width; do not claim tests with real training from mock-only evidence.
- [x] Run `pnpm typecheck && pnpm lint` and confirm the new behavior is missing before implementation; do not count import/setup failures as behavioral evidence.
- [x] Implement the specified interfaces and behavior, keeping public types aligned with Q-085 and preserving the existing patterns named above.
- [x] Run `pnpm typecheck && pnpm lint` and confirm the focused suite passes.
- [x] Commit this independently reviewable unit on the task branch with a conventional, focused message.

## Verification and handoff

- [ ] Review spec coverage and all five review-focus conditions against the focused tests above; fill any gaps before completion.
- [ ] Run `make contracts-check` and `TZ=America/Sao_Paulo pnpm ci` once after the final change. Do not wrap canonical CI in resource-slice commands. No Wine, GPU or desktop run is required.
- [ ] Update task documentation with actual checks/results and any blocked prerequisites; do not claim unrun checks passed.
- [ ] Commit final docs/code and use `./work board set Q-088 in-review -m "<changes; checks/results; follow-ups>"`. Human review/finish owns integration and publication.

## UI/UX revision after human review (2026-10-04)

The human approved replacing the long stacked form with the incumbent Q workbench layout. Sources and saved models now occupy a compact sidebar, beside separate Train, Compare and Final Evaluation views. Shared entity cards, segmented controls and well materials replace raw selections; source summaries and short version identifiers lead with readable context. Training shows model choices and the chronological split first, with features, seed and tuning in Advanced. The training action retains a visible validation reason. Trading comparison includes the unfiltered baseline metrics with aligned numeric columns.

Stage switching preserves drafts and jobs. Changing sources after completed training does not erase an existing comparison or reserved-tail evaluation; dataset changes reset stage-specific drafts. Regression coverage includes stage/source switching and the baseline metric row.

Browser review used MSW, with desktop 1920×1080, narrow desktop 1100×800 and stacked 900×800 captures. The mocked source → train → compare → final-evaluation workflow completed without page or console errors. Advanced validation guidance, scrolling/action reachability, no horizontal overflow or stacked overlap, and preserved final results after source changes were checked. The Research integration test verifies model selection → Use in Backtest. These checks do not establish real-backend training or native Tauri behavior.

Verification: canonical `TZ=America/Sao_Paulo pnpm run ci` passed contracts, typecheck, lint, formatting, all 1,002 frontend tests, production build and Tauri Rust checks. A first run exposed the old saved-model Details-button integration locator; updating it to the new entity-card selection preserved the same pinned-backtest assertions. Existing unrelated test warnings remain. The design review scored its required fixes resolved. The human requested committing the revision on the current Q-088 branch. Inspection supports new commits on the named branch; the detached task worktree and inspection journal remain unchanged.

## Training feedback follow-up (2026-10-04)

Training feedback now lives above the stage views and remains visible when switching stages or sources. Submission feedback and request errors appear above the setup fields. The job panel reports server-owned stages and counts, distinguishes queued from running, and warns after 30 seconds of observed queued state without claiming failure or inventing progress. Monitoring duration describes time spent in this view, not server execution time. Errors keep polling and offer a manual check. Completed runs show saved model versions and validation ROC AUC with an explicit action to open comparison for their dataset.

Real runtime investigation found the worker failed importing the ML service before claiming the job, leaving it queued. The human explicitly authorized backend repair without a board task. The repair is on a separate backend branch.

Follow-up verification: frontend canonical CI passed all six stages with 1,005 tests. The progress follow-up has 16 focused source/training tests, covering queued delay, visible submission failure, completion scores and dataset handoff. Backend branch `fix/ml-filter-worker-import` fixes lazy API startup, the source-loader database import, and saved-model score serialization; 60 ML/API tests and repository Ruff/Black checks passed. Real job `67b53ed667ce4ab0a66bed8b894a2c1f` completed with three models, and validation comparison `975adaec7a0549d4a071c3ea811d9d69` completed. A browser preview using the real Research API showed all three AUC scores and the baseline/filtered trading table without page errors, at desktop and narrower widths. The completed-job panel is compact on Compare and Final Evaluation. The reserved tail was not evaluated during this verification.
