# WO161 — Backend: instrument profiles and curated hypothesis catalog

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md`. Depends on WO159 and WO160. This WO changes
the starting point of research from arbitrary indicator trees to named, inspectable economic
hypotheses. It does not claim that any hypothesis is profitable.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO159 and WO160 completion messages
- `src/q_backend/optimization/strategy_search.py`
- `src/q_backend/optimization/search_space.py`
- `src/q_backend/optimization/genetic_search.py`
- `src/q_backend/backtesting/genome/registry_fixtures.py`
- `src/q_backend/backtesting/genome/search_space.py`
- `src/q_backend/backtesting/strategy_registry.py`
- `src/q_backend/api/schemas/strategy_search.py`

## Goal

Provide three versioned research profiles and a deterministic `HypothesisCandidateProvider` that
emits bounded genome templates, search spaces, rationale, expected holding horizon, and required
features.

Required profiles and initial hypotheses:

### `ccm_h1_swing`

- Volatility-normalized medium-term breakout.
- Trend pullback conditioned on higher-timeframe trend.
- Range-reversion only in low-trend/contained-volatility regimes.
- Calendar-conditioned variants using month/day information as gates, never learned lookup tables.

### `win_h1_swing`

- Higher-timeframe trend continuation.
- Compression-to-breakout transition.
- Pullback/reversal conditioned on volatility and prior-session levels.
- Variants gated by lagged WDO direction, volatility, or relative-strength context.

### `wdo_m15_day`

- Opening-range breakout with explicit range-completion timing.
- Opening-range failure/reversion.
- Prior-day level breakout/rejection.
- Intraday momentum/reversion conditioned on session and volatility regime.
- Variants gated by lagged WIN direction/context; mandatory end-of-day flattening.

## Tasks

1. Add versioned `InstrumentResearchProfile`, `HypothesisDefinition`, and `HypothesisCandidateMetadata`
   models. Profiles own symbol/timeframe/style, target horizons, session rules, evidence thresholds,
   and minimum observation counts.
2. Implement a catalog with stable hypothesis IDs and human-readable rationales. Each definition
   declares required feature IDs, genome template builder, bounded parameter search space, permitted
   exit families, and incompatibilities.
3. Implement `HypothesisCandidateProvider` using the existing `CandidateProvider` protocol and define
   an injectable `FeatureAdmissionResolver` boundary. Output is deterministic for a fixed catalog
   version and seed. WO161 defines the catalog declarations and resolver contract; the production
   eligibility gate is wired when WO162's evidence query lands. WO161 unit tests use an explicit
   admitted-all stub only to exercise catalog/provider mechanics.
4. Add an optional genetic seeding adapter that injects admitted hypothesis genomes into part of the
   initial population while retaining diversity/random candidates. Do not make the GA a prerequisite
   for evaluating the curated templates.
5. Persist profile version, hypothesis ID, rationale, required features, and template hash with every
   candidate and promoted backtest/optimization payload.

## Guardrails

- Instrument-specific logic is allowed and expected; do not force one common strategy.
- Keep the initial catalog small and named. Do not generate thousands of arbitrary templates.
- Every hypothesis must state why its data should contain information and the horizon it targets.
- Missing required feature evidence makes a hypothesis ineligible, not silently downgraded.
- Before WO162 lands, the production resolver fails closed; an admitted-all resolver is test-only and
  must never be the runtime default. Do not create a temporary persistence/query implementation in
  WO161 that WO162 would replace.
- WDO M15 hypotheses must close positions by the configured session close.
- No lock-box data influences catalog membership or parameter bounds.

## Tests

- Snapshot each profile's IDs, required features, search-space bounds, and template hashes.
- Compile/validate/backtest every template on deterministic synthetic data.
- Causality tests for every template including prior-session, higher-timeframe, and exogenous gates.
- Same seed/catalog version produces identical candidates; catalog version changes are explicit.
- Missing-feature and incompatible-profile errors are structured and actionable.
- Resolver-contract tests cover an admitted-all test stub and a fail-closed production default;
  WO162 owns the real admitted/rejected/inconclusive evidence lookup integration.
- Genetic seeding includes admitted hypotheses without eliminating random-population diversity.
- Run targeted genome, strategy-search, genetic, walk-forward, and API schema tests, then full
  `uv run pytest`.

## Docs

Add the final catalog table and stable IDs to the design doc. Document how a new hypothesis is added
without changing the evaluator.

## Definition of done

Each approved instrument has an inspectable, reproducible hypothesis set that can be evaluated before
genetic recombination and retains its identity through results and promotion.

## Out of scope

Feature evidence computation (WO162), final acceptance (WO163), experiment orchestration (WO164), and
claiming that a catalog hypothesis has edge.
