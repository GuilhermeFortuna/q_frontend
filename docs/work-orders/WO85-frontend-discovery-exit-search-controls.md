# WO85 — Frontend: Discovery exit-search request controls

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build:
    `pnpm build`

**Context for this work:** WO79-WO81 added backend controls for exit-preset expansion, genetic
exit-policy seeding, and exit-quality scoring diagnostics. WO82 renders exit insights when the backend
sends them. A review found that the frontend still cannot request the new backend knobs: the
`StrategySearchConfig` type and Discover submit payload do not include `exit_presets`,
`exit_quality_scoring`, or the WO80 genetic fields. Users therefore cannot deliberately search exit
logic more aggressively from the Discover UI.

This WO is frontend-only. It adds typed request support and minimal operational controls while keeping
the existing default Discover workflow unchanged.

---

## How the pieces work today (read these files)

- `src/types/strategySearch.ts`
  - `StrategySearchConfig`, `GeneticSearchConfig`, `CandidateResult`.
- `src/components/discover/DiscoverConfigForm.tsx`
  - constructs the `StrategySearchConfig` POST body.
- `src/components/discover/DiscoverGeneticSection.tsx`
  - genetic configuration UI.
- `src/components/discover/DiscoverGatesSection.tsx`
  - pattern for compact operational controls.
- `src/lib/discover/geneticConfigSchema.ts`
  - genetic form validation defaults/schema.
- `src/api/queries/strategySearch.ts`
  - `startStrategySearch(body)`.
- `src/mocks/strategySearch.ts` and `src/mocks/handlers.ts`
  - mock request/result payloads.
- Tests to read/extend:
  - existing `tests/unit/components/GeneticDiscover.test.tsx`
  - Discover config/form tests if present
  - `tests/unit/lib/promoteCandidate.test.ts`

---

## Review finding this fixes

Backend added request fields:

```python
exit_presets: ExitPresetSearchConfig
exit_quality_scoring: ExitQualityScoringConfig
genetic.seed_exit_policies
genetic.exit_policy_preset_ids
genetic.exit_policy_seed_fraction
```

Frontend `StrategySearchConfig` currently omits them, and `DiscoverConfigForm` never sends them.

## Goal

Discover can start a search that explicitly asks the backend to explore exits:

- registry mode can enable exit-preset candidate expansion;
- genetic mode can control exit-policy seeding fraction and optional preset ids;
- exit-quality diagnostics/scoring config is represented in the request type and can be sent when
  enabled;
- default UI state sends the same behavior as today unless the user opts in.

## Tasks

### 1. Extend request types additively

In `src/types/strategySearch.ts`, add frontend types matching the backend contract:

```ts
export type ExitPresetSearchConfig = {
  enabled: boolean
  preset_ids?: string[] | null
  include_baseline?: boolean
  pin_non_preset_exits_off?: boolean
}

export type ExitQualityScoringConfig = {
  enabled: boolean
  min_mfe_capture_ratio?: number | null
  max_profit_giveback_pct?: number | null
}
```

Extend `GeneticSearchConfig` with:

```ts
seed_exit_policies?: boolean
exit_policy_preset_ids?: string[] | null
exit_policy_seed_fraction?: number
```

Extend `StrategySearchConfig` with optional:

```ts
exit_presets?: ExitPresetSearchConfig
exit_quality_scoring?: ExitQualityScoringConfig
```

All fields must be optional where possible so old mocks/results and older backend payloads remain safe.

### 2. Add minimal Discover controls

In registry mode, add a compact control near the strategy/provider settings:

- toggle: "Search exit presets"
- optional include-baseline toggle if space allows
- preset selection can be omitted in the first pass; `preset_ids: null` means all backend presets.

In genetic mode, add controls in `DiscoverGeneticSection`:

- toggle: `seed_exit_policies`
- numeric control for `exit_policy_seed_fraction` from `0` to `1`
- leave `exit_policy_preset_ids` as `null` unless a preset picker already exists nearby.

Do not add explanatory/tutorial copy. Labels and compact helper text are enough.

### 3. Build the submit payload correctly

In `DiscoverConfigForm`, include:

- `exit_presets` only for registry mode;
- `genetic.seed_exit_policies` and `genetic.exit_policy_seed_fraction` for genetic mode;
- `exit_quality_scoring` only when the UI exposes/enables it, otherwise rely on backend defaults.

Important backend rule: `exit_presets.enabled` is rejected when `genetic` is present. The frontend must
not send enabled registry exit presets in genetic mode.

### 4. Update defaults, validation, mocks

- Add defaults to the same place as other Discover defaults.
- Validate `exit_policy_seed_fraction` as `0 <= value <= 1`.
- Update mocks to include at least one request/result where exit search is enabled.
- Keep promote payload behavior unchanged; diagnostics and UI-only fields must not pollute promoted
  strategy params.

## Guardrails

> **Default behavior unchanged.** With all new toggles off/default, the request body should match the
> current non-exit Discovery behavior except for harmless omitted optional fields.

> **Respect backend mode split.** `exit_presets.enabled` is registry-only. Genetic mode uses
> `genetic.seed_exit_policies`.

> **Operational UI only.** Do not add marketing/explainer panels. Keep controls compact and consistent
> with existing Discover sections.

> **Older backend compatibility.** Optional fields should be easy to omit if a local backend predates
> WO79-WO81.

## Tests

- Type/request tests:
  - registry mode with "Search exit presets" sends `exit_presets.enabled: true`;
  - registry mode default omits or disables `exit_presets`;
  - genetic mode sends `genetic.seed_exit_policies` and `exit_policy_seed_fraction`;
  - genetic mode does not send enabled `exit_presets`.
- Validation tests:
  - seed fraction outside `[0, 1]` is rejected or clamped by the form.
- Existing WO82 tests still pass:
  - exit insight rendering;
  - promote payloads remain clean.

## Docs

`q_frontend/README.md`: update the Discover workspace bullet to mention that exit search can be
enabled from the run configuration, not only displayed after results arrive.

---

## Definition of done

- `pnpm test:run`, `pnpm exec tsc -p tsconfig.app.json --noEmit`, and `pnpm build` pass. **Do not
  report completion until all three pass.**
- Users can opt into more aggressive exit search from Discover without hand-editing JSON.
- Final message must paste:
  - the new request fields,
  - the registry-vs-genetic mode behavior,
  - the tests that prove the payload split.

## Out of scope

- Backend implementation of exit search.
- New exit-insight visualizations beyond existing WO82 panels.
- A full preset picker if no reusable picker exists yet.
