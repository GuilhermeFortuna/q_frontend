# WO200 — Backend: multi-provider AI model registry (local + Gemini selectable per request)

## Shared context (read first)

First of the **WO200–WO201 pair**. Execution sequence: `200 → 201`, strictly serial — WO201
(frontend picker) consumes the wire contract this WO defines; do not run them in parallel.

WO187 added a Gemini provider to the AI Strategy Builder, but provider selection is a
boot-time switch: `build_strategy_interpreter_provider` returns the single provider named by
`Q_AI_STRATEGY_PROVIDER`, `/models` lists only that provider's curated models, and the UI can
never show local and Gemini models together. This WO turns the single factory into a
**registry of all configured providers**, tags every model with its provider on the wire, and
routes `/interpret` per request. `Q_AI_STRATEGY_PROVIDER` is downgraded from "the only
provider" to "the default" — **no existing `.env` breaks**.

Two-repo project: backend `q_backend` uses `uv` (`uv run pytest` — never pip/poetry);
frontend `q_frontend` uses `pnpm` (never npm). Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `q_backend/src/q_backend/strategy_builder/providers/factory.py` —
  `build_strategy_interpreter_provider(settings)` branches on `settings.ai_strategy_provider`
  (`"openai_compatible"` | `"gemini"`); Gemini raises `AiMisconfiguredError` without
  `ai_strategy_gemini_api_key`
- `q_backend/src/q_backend/strategy_builder/providers/openai_compatible.py` — reference
  provider; best-effort `list_models()` returning `[]` on any failure
- `q_backend/src/q_backend/strategy_builder/providers/gemini.py` — WO187 provider;
  `list_models()` calls Google's `GET {base_url}/models`
- `q_backend/src/q_backend/strategy_builder/ai_models.py` — `build_curated_model_options`
  parses `Q_AI_STRATEGY_MODELS` (`id|Label,…`); `is_model_available`;
  `resolve_interpret_model`
- `q_backend/src/q_backend/strategy_builder/interpret_models.py` — `AiModelOption`
  (`id`,`label`,`available`), `AiStrategyModelsResponse` (`provider`,`default_model`,
  `models`), the interpret request model (has `model: str | None`)
- `q_backend/src/q_backend/api/routers/strategy_builder.py` — `_build_ai_provider()`,
  `/models` (line ~127), `/interpret` (`resolve_interpret_model(request.model, settings)` at
  ~181); error mapping 503 disabled/misconfigured, 502 provider_error
- `q_backend/.env.example` lines 17–38 — existing `Q_AI_STRATEGY_*` and
  `Q_AI_STRATEGY_GEMINI_*` vars

## Goal

```python
# providers/factory.py
def build_strategy_interpreter_providers(settings) -> dict[str, InterpreterProvider]:
    """Every provider whose config is present: 'openai_compatible' if base URL set,
    'gemini' if API key set. settings.ai_strategy_provider names the default."""
```

```jsonc
// GET /api/v1/strategy-builder/models
{
  "provider": "openai_compatible", // default provider (unchanged field)
  "default_model": "gemma4-e4b:latest",
  "providers": [
    { "id": "openai_compatible", "label": "Local (Ollama)" },
    { "id": "gemini", "label": "Gemini" },
  ],
  "models": [
    {
      "id": "gemma4-e4b:latest",
      "label": "Gemma 4 E4B",
      "available": true,
      "provider": "openai_compatible",
    },
    {
      "id": "gemini-2.5-flash",
      "label": "Gemini 2.5 Flash",
      "available": true,
      "provider": "gemini",
    },
  ],
}
```

`POST /interpret` gains optional `provider: str | None`; absent → the default provider
(today's behavior, byte-for-byte).

## Tasks

1. **Registry.** Add `build_strategy_interpreter_providers(settings)` to `factory.py` per the
   Goal signature. A provider is _configured_ when: `openai_compatible` — base URL non-empty;
   `gemini` — API key non-empty. Keep `build_strategy_interpreter_provider` (singular)
   delegating to the registry + default lookup so existing callers/tests still work. If the
   registry is empty and AI is enabled, raise `AiMisconfiguredError` (existing 503 mapping).
   `settings.ai_strategy_provider` must name a _configured_ provider or `AiMisconfiguredError`
   (same message style as today's unknown-provider error).
2. **Per-provider curated lists.** `Q_AI_STRATEGY_MODELS` stays the curated list for
   `openai_compatible`. Add `Q_AI_STRATEGY_GEMINI_MODELS` (same `id|Label,…` format) with
   default `gemini-2.5-flash|Gemini 2.5 Flash,gemini-2.5-pro|Gemini 2.5 Pro`. Generalize
   `build_curated_model_options(settings, provider_id)` accordingly.
3. **Wire schema.** `AiModelOption` gains `provider: str`; `AiStrategyModelsResponse` gains
   `providers: list[AiProviderOption]` (`id`, `label` — labels: `openai_compatible` →
   `"Local (Ollama)"`, `gemini` → `"Gemini"`). Existing fields keep their names and meaning
   (`provider` = default provider id, `default_model` unchanged) — **additive only**.
4. **`/models` aggregation with failure isolation.** For each configured provider, gather
   curated options; availability:
   - `openai_compatible`: today's behavior — `list_models()` probe, `available` =
     `is_model_available(...)` (Ollama semantics: "is the model pulled").
   - `gemini` (remote): **do not block on Google** — skip the `list_models()` probe entirely
     in `/models` and mark curated models `available=True`. Remote availability is a
     curated-list contract, not a probe; a Gemini outage surfaces at `/interpret` as the
     existing 502.
     One provider's probe failure must never drop the other provider's models from the
     response (wrap per-provider gathering; on unexpected exception, log and continue).
5. **`/interpret` routing.** Add optional `provider: str | None = None` to the interpret
   request model. Resolution: `provider or settings.ai_strategy_provider`; unknown or
   unconfigured id → 422 with a clear message (not 503 — the service is fine, the request is
   wrong). Generalize `resolve_interpret_model(request.model, settings, provider_id)` to
   validate the model against _that provider's_ curated list (current behavior, per
   provider). Pass the resolved provider instance where `_build_ai_provider()` is used today.
6. **`.env.example`.** Document the new world: all configured providers are served;
   `Q_AI_STRATEGY_PROVIDER` = default; add the `Q_AI_STRATEGY_GEMINI_MODELS` line.

## Guardrails

> **Backward compatibility is the contract**: a `.env` from before this WO (single provider,
> no new vars) must produce byte-identical `/models` core fields (`provider`,
> `default_model`, `models[].id/label/available`) plus the new additive fields, and
> `/interpret` without `provider` must behave exactly as today.
> **No blocking remote calls in `/models`**: the endpoint's latency must not depend on
> Google. (The existing Ollama probe is localhost and stays.)
> **Additive schema only** — no field renames/removals (the WO56–60 API lessons and the
> house review checklist apply).
> **No new dependencies**; the Gemini provider itself (WO187) is read-only here except for
> what routing requires.
> **Determinism**: model option order = curated-list order, providers in fixed order
> (default provider first).

## Tests

Extend `q_backend/tests/` where WO187's provider/router tests live (locate them):

- registry: both configured → dict of two; only base URL → local only; only key → gemini
  only; neither + AI enabled → `AiMisconfiguredError`; default not configured → error.
- `/models`: two providers configured → merged tagged list, `providers` summary, default
  first; local `list_models()` raising → gemini models still present; gemini never probed
  (assert no HTTP call to the Google base URL — use the existing HTTP-mocking pattern).
- `/interpret`: `provider="gemini"` routes to the Gemini provider (mock transport);
  omitted → default provider; unknown provider → 422; model not in that provider's curated
  list → existing invalid-model handling.
- Back-compat: single-provider `.env` fixture → response equals today's shape + additive
  fields.

## Docs

Update the AI-builder section of the backend docs (wherever WO187 documented provider
config): registry semantics, default-provider meaning, new env var, and the
remote-availability decision (curated = available; failures surface at interpret time).

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must include:
the final `/models` response JSON from a two-provider test run, the interpret request model
diff, and confirmation of the back-compat test. Production trigger: none — `/models` and
`/interpret` are already routed; behavior activates for any `.env` that configures both
providers.

## Out of scope

Frontend changes (WO201); streaming; per-conversation provider pinning; adding more
providers (the registry makes that a follow-up pattern); touching the Gemini provider's
interpret implementation; API-key management UI.
