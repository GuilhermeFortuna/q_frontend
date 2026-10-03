# Q-088: ML filter research workflow

**Status:** written spec and plan awaiting human review; status of record is the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2).
**Batch:** 14 — ML entry filters for research
**Depends on:** Q-087
**Implementation plan:** [Plan](../plans/Q-088-ml-filter-research-workflow-plan.md)

## Purpose and user flow

Provide a research UI workflow to train interchangeable entry classifiers from an existing MA Crossover backtest, compare them on validation data, select a saved version and backtest MA Crossover · ML Filter. Extend the current ResearchWorkspace and Backtests setup/history; reuse existing controls, theme, query/job progress and MSW conventions. Existing Neural Features tab remains an encoder workflow.

## Required behavior

1. Add `ML Filters` research tab (search value `ml-filters`) with training form, durable jobs, saved model list/detail and comparison results. A completed eligible backtest offers `Train ML filter` opening this tab with its source run selected. Direct navigation can select a source from Q-085 sources API; show eligibility reasons, not just an empty selector.
2. Source summary shows symbol/timeframe, MA parameters, exits/costs/sizing, bar range, volume availability and completed sample count. Feature selection uses Q-085 allowlist/order, default all available OHLCV plus four MA indicators and mandatory side. Explain that inputs are from the closed signal candle and target is source trade net profitability; no feature-engineering editor or upload.
3. Train form defaults algorithms LightGBM/Random Forest/logistic regression, seed 42 and server-suggested chronological 60/20/20 split. Show explicit editable train_end/validation_end, preview local exchange labels with canonical UTC requests and train/validation/reserved-tail ranges. Render algorithm-specific validated parameter controls with Q-086 defaults. Source/config changes reset stale compatibility/splits; submitted request pins the source and feature order.
4. Submit async training; show dataset/fitting/validation/persisting stages, honest sample/rejection counts, failures and completion. Do not publish frontend-only fake progress or stop jobs on tab change. Persist active job ids with existing workspace/storage patterns; refresh/reload retrieves terminal state without reliance on Redis TTL. Disable duplicate submissions while the same form request is pending.
5. Compare saved versions sharing one dataset/split. Table shows algorithm, features/training boundary, threshold, net PnL, max drawdown, profit factor, actual trade count and candidate acceptance counts; classification diagnostics are separate. Threshold default 0.50, range [0,1], inclusive acceptance. Threshold change requires a new comparison job and displayed results retain the threshold that produced them. Undefined metrics show unavailable with server reason rather than zero/infinity.
6. Final evaluation selects exactly one model version/threshold and consumes the reserved tail. Explain that validation was used for selection and this workflow reserves the tail, without claiming the original source was never inspected. Show the frozen selection before submission; retry the same tuple reopens its existing record, consumed/conflicting datasets show reasons and cannot start a different selection. Do not expose tail results in validation rankings before evaluation.
7. Backtests can select the separate registered variant. Show a dedicated model-version selector and threshold editor, separate from MA numeric params. Explain close-on-opposite-crossover with independent new-entry approval. List compatible ready versions with algorithm/training end and incompatibility reasons; selected version is never replaced automatically by a retrain. Model selection inherits its baseline semantic configuration with explicit visible form values; later incompatible edits require correcting the config or choosing another compatible model.
8. Only single-entry candle/or configurations support this variant. Hide/disable extra-entry controls for it, provide actionable errors for incompatible restored configurations, and exclude it from Optimize/Validate/Discover and live paths using registry capabilities. The standard original strategy form remains unchanged.
9. `Use in Backtest` from a model opens a variant setup using its pinned MA/exit/cost/sizing/day-trade context and evaluation range at/after train_end. Restore ml_filter from saved backtests; show exact version/threshold and summary in results/history. Loading/missing/corrupt/incompatible model states cannot silently clear or substitute the model. Backtest dates overlapping training require correction; warm-up is a backend detail.
10. MSW implements the real generated contracts, with train/comparison/final-evaluation job lifecycles, compatible and incompatible versions, unavailable volume, single-class metrics, not-ready candidates and failure states. Inputs have labels, keyboard operation and field errors; progress is accessible and navigation does not lose results.

## Interfaces and ownership

Vendor the published Q-085 contracts via CONTRACTS_REV and standard generation. Create `src/api/queries/mlFilters.ts`, `src/components/research/ml-filters/{MLFiltersTab,MLFilterTrainForm,MLFilterModels,MLFilterComparison,MLFilterEvaluation}.tsx`, `src/components/backtests/setup/MLFilterConfig.tsx`, `src/mocks/mlFilters.ts`, and focused colocated tests. Modify ResearchWorkspace.tsx, types/features.ts and src/app/router.tsx search validation; extend lib/backtesting/useBacktestConfig.ts, entryInstances.ts and BacktestSetupPanel.tsx plus request/history serialization. Reuse existing backtest and neural query patterns without importing encoder-specific types into ML training.

## Acceptance criteria

1. With MSW, choose an existing source, adjust features/splits/algorithms, train, navigate/reload, compare saved versions and launch the separate strategy with the exact saved model/threshold.
2. Backtest history restores model/config/date range; original MACrossover and encoder flows remain compatible. Incompatible edits, missing models and restored unsupported combinations show correct errors and cannot submit.
3. Feature defaults/mandatory side, volume readiness, split boundaries and UTC/exchange-time conversion match API requests. Changed threshold never relabels stale results.
4. Final evaluation shows one frozen tuple, correctly handles retries/conflicts, and keeps reserved-tail results separate from validation selection.
5. Failure, empty-source/model, loading, undefined-metric and navigation states are covered with honest accessible copy and keyboard operation.
6. Focused React/query/config tests with TZ=America/Sao_Paulo, typecheck, lint, contracts-check and canonical frontend CI pass. Browser/MSW verification covers the complete flow; no desktop/GPU/Wine run is required.

## Delivery boundary

Written specification and plan await human review. No implementation is authorized by this documentation session. Integrate/publish the documentation before launch; the human approves plans and sets Todo. Start only with `./work start Q-088 --agent <agent> --worktree` after dependencies are Done. Implement natively; delegation requires separate authorization. Never push, merge, edit vendored contracts, or change board status outside the workspace workflow.

Batch 14 is research-only: no live deployment, q_terminal integration, automatic walk-forward retraining, optimizer/discovery support, multi-entry ML combinations, custom uploads, or GPU requirement. Existing MACrossover behavior and saved configurations remain compatible. Python orchestrates model inference; existing q_core indicator and execution semantics are reused without another fill/indicator implementation.
