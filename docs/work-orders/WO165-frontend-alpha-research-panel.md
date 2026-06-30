# WO165 — Frontend: instrument Alpha Research experiment panel

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md`. Depends on WO164. This is an operator and
evidence-inspection surface inside the existing Research -> Experiments workspace; it is not a new
top-level route and does not change normal Discovery.

Frontend repo: `q_frontend`, managed with `pnpm`.

## Files to read

- WO164 completion message and sample contracts
- `src/workspaces/research/ExperimentsWorkspace.tsx`
- `src/components/research/experiments/DiscoveryAbPanel.tsx`
- `src/components/research/experiments/EncoderAblationPanel.tsx`
- `src/api/queries/experiments.ts`
- `src/types/experiments.ts`
- `src/mocks/experiments.ts`
- `src/components/discover/GeneticVerdictPanel.tsx`
- `src/components/research/FeatureScoringDashboard.tsx`

## Goal

Let an operator launch one of the three approved research profiles and understand why the result is
ready for paper trading, rejected, or inconclusive without reading backend logs or raw artifacts.

## Tasks

1. Extend experiment types and query hooks for alpha-research start/status polling and artifact links.
2. Add an `AlphaResearchPanel` to the existing Experiments workspace. Launch form selects one of:
   - CCM$ H1 swing;
   - WIN$ H1 swing;
   - WDO$ M15 day trade.
     It accepts date range and bounded compute budget only; acceptance thresholds come from the profile
     and are displayed read-only.
3. Render the pipeline stages with real status and counts: data preflight, feature evidence,
   hypotheses admitted, candidates evaluated, repeated seeds, parameter plateau, DSR, lock-box, and
   verdict.
4. Render evidence tables:
   - admitted/rejected/inconclusive features with fold/null diagnostics;
   - hypothesis rationale and required features;
   - per-seed and per-window results;
   - parameter-neighborhood stability;
   - acceptance criterion rows with observed/threshold/reason;
   - frozen candidate/genome and links to existing Backtest/Optimize promotion flows.
5. Use distinct terminal language and visual states:
   - `READY FOR PAPER TRADING` — not “profitable” or “live ready”;
   - `REJECTED`;
   - `INCONCLUSIVE — MORE/VALID DATA REQUIRED`.
6. Preserve failed/cancelled child details. Never display zero samples as no effect or success.
7. Add MSW fixtures only for tests; production state starts empty and reads the API.

## Guardrails

- No new standalone Alpha or Strategy route.
- No threshold editing after results are visible.
- Do not collapse detailed criteria into a single green badge.
- Do not imply profitability guarantees or live readiness.
- Hidden/inactive experiment panels stop polling.
- Reuse existing Backtest/Optimize promotion seams; do not create a third execution path.
- No `@/mocks` import in production components.

## Tests

- Launch each profile and verify exact request payload/profile ID.
- Running job shows stage progress and polls; inactive panel does not poll.
- Ready/rejected/inconclusive fixtures render different language and complete criterion evidence.
- Zero-sample/incomplete fixture renders inconclusive and never “no effect.”
- Candidate promotion uses existing pending Backtest/Optimize configuration paths.
- Failed/cancelled job preserves backend detail.
- Run relevant Vitest suites, `pnpm typecheck`, `pnpm build`, and the production mock-import grep.

## Docs

Mark WO165 implemented and the batch complete only after a real backend payload is rendered without
fixture fallback.

## Definition of done

The Research workspace exposes the full evidence funnel and accurately communicates whether a
candidate deserves paper trading.

## Out of scope

Backend changes, paper-trading execution, live deployment, a universal cross-market strategy, and
WDO M5 until its data continuity gate passes.
