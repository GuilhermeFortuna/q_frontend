# WO187 — Backend: Gemini provider for the AI Strategy Builder

## Shared context (read first)

Standalone WO (independent of the WO188–WO190 gateway batch). The AI Strategy Builder
(WO90–106) interprets natural language into a StrategySpec through a pluggable provider
seam: `Q_AI_STRATEGY_PROVIDER` selects an implementation of `StrategyInterpreterProvider`,
and today the only implementation is `openai_compatible` (used with a local Ollama server).
This WO adds a first-class `gemini` provider so the user can point the builder at the
Google Gemini API instead of a local model — same prompts, same JSON parsing, same
allowlist mechanics.

Two repos: backend `q_backend` is Python managed with `uv` (`uv run pytest` — never
pip/poetry); frontend `q_frontend` uses `pnpm` (never npm). Paths below are relative to
`C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `q_backend/src/q_backend/strategy_builder/providers/base.py` —
  `StrategyInterpreterProvider` Protocol + `RawAiResponse`
- `q_backend/src/q_backend/strategy_builder/providers/openai_compatible.py` — the reference
  implementation: stdlib `urllib` only, `ProviderRequestError` (message + truncated detail),
  best-effort `list_models()` that returns `[]` on any failure
- `q_backend/src/q_backend/strategy_builder/providers/factory.py` —
  `build_strategy_interpreter_provider` branches on `settings.ai_strategy_provider`;
  `AiDisabledError` / `AiMisconfiguredError`
- `q_backend/src/q_backend/strategy_builder/ai_models.py` — curated model options parsed from
  `Q_AI_STRATEGY_MODELS` ("id|Label,…"), allowlist, `resolve_interpret_model`,
  `is_model_available`
- `q_backend/src/q_backend/api/routers/strategy_builder.py` — `/models` endpoint
  (`isinstance(provider, OpenAICompatibleInterpreterProvider)` gate around `list_models()`),
  `/interpret` error mapping (503 disabled/misconfigured, 502 provider_error)
- `q_backend/src/q_backend/strategy_builder/interpreter.py` — calls
  `provider.interpret(request, capabilities, system_prompt=…, user_prompt=…, model=…)`
- `q_backend/src/q_backend/storage/settings.py` — the `ai_strategy_*` settings block
  (env prefix `Q_`)

## Goal

```python
# src/q_backend/strategy_builder/providers/gemini.py
class GeminiInterpreterProvider:
    provider_name = "gemini"
    # POST {base_url}/models/{model}:generateContent  (header: x-goog-api-key)
    # GET  {base_url}/models  -> list_models()
```

`Q_AI_STRATEGY_PROVIDER=gemini` + `Q_AI_STRATEGY_GEMINI_API_KEY=…` +
`Q_AI_STRATEGY_MODEL=gemini-2.5-flash` makes `/interpret` and `/models` work exactly as
they do with Ollama today, with no frontend API changes.

## Tasks

1. Settings (`storage/settings.py`), added to the existing `ai_strategy_*` block:
   - `ai_strategy_gemini_api_key: str = ""` (separate from `ai_strategy_api_key` so both
     providers can stay configured and the user flips only `Q_AI_STRATEGY_PROVIDER`);
   - `ai_strategy_gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"`.
     `ai_strategy_model`, `ai_strategy_models`, `ai_strategy_timeout_seconds`,
     `ai_strategy_max_output_tokens` are provider-agnostic and are reused as-is.
2. Move `ProviderRequestError` from `providers/openai_compatible.py` to `providers/base.py`;
   keep a re-export in `openai_compatible.py` so existing imports (router, tests) keep
   working. Both providers raise it.
3. Create `providers/gemini.py` — stdlib `urllib` only, mirroring the structure of
   `openai_compatible.py`:
   - `interpret(...)`: POST `{base_url}/models/{model}:generateContent`, header
     `x-goog-api-key`, body
     `{"system_instruction": {"parts": [{"text": system_prompt}]},
"contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
"generationConfig": {"temperature": 0.2, "maxOutputTokens": …,
"responseMimeType": "application/json"}}`.
     `responseMimeType` is deliberate — Gemini then emits bare JSON, which feeds
     `parse_ai_interpreter_response` without markdown-fence stripping.
     Extract `candidates[0].content.parts[0].text` (concatenate parts if several).
     Defensive mapping to `ProviderRequestError`: HTTP error → detail `HTTP {code}: {body[:500]}`;
     missing/empty candidates or missing `parts` (safety-blocked or truncated responses) →
     detail includes `finishReason` and `promptFeedback.blockReason` when present; timeout and
     unreachable cases mirror the openai_compatible wording.
   - `list_models()`: GET `{base_url}/models`, return ids stripped of the `models/` prefix,
     filtered to entries whose `supportedGenerationMethods` include `generateContent`.
     Best-effort like the reference: any failure logs at info and returns `[]`.
4. Factory (`providers/factory.py`): branch `provider == "gemini"` → require non-empty
   `ai_strategy_model` and `ai_strategy_gemini_api_key` (else `AiMisconfiguredError` naming
   the exact env var); update the unsupported-provider message to
   "Supported providers: openai_compatible, gemini."
5. Router (`api/routers/strategy_builder.py`): replace the
   `isinstance(provider, OpenAICompatibleInterpreterProvider)` gate with a duck-typed
   `list_models = getattr(provider, "list_models", None)` so `/models` reports availability
   for any provider that can list models.
6. Frontend copy (`q_frontend/src/components/backtests/setup/AiStrategyPanel.tsx`): the
   misconfigured/empty-models hint hardcodes "Start the Ollama server (and pull a model) to
   enable models." Make it provider-aware using the `provider` field the `/models` response
   already carries (e.g. gemini → "Check your Gemini API key"). No other frontend changes —
   the models/interpret payload shapes are unchanged.

## Guardrails

> No new backend dependencies — stdlib `urllib` only, like the reference provider. Do not
> add `google-genai`/`google-generativeai`.
> The API key must never be logged, echoed in error details, or returned by any endpoint.
> Prompts (`interpret_prompt.py`), parsing (`interpret_parser.py`), and the interpreter
> orchestration are read-only — this WO adds a transport, not a behavior change.
> Note for the record: Gemini also exposes an OpenAI-compatible endpoint
> (`{base}/openai/` with a Bearer key) that works with the existing provider as a
> config-only escape hatch; we still build the native provider for first-class error
> mapping, the `x-goog-api-key` header, and `responseMimeType` JSON mode. Document the
> escape hatch in the provider docstring.

## Tests

- `tests/api/test_strategy_builder_gemini_provider.py` (new; mock `urllib.request.urlopen`
  like the existing provider tests do): happy-path interpret (payload shape asserted —
  system_instruction, responseMimeType, header present); parts concatenation; empty
  candidates with `promptFeedback.blockReason` → `ProviderRequestError` whose detail names
  the block reason; HTTP 429/500 → `ProviderRequestError`; `list_models` strips `models/`
  and filters on `generateContent`; `list_models` network failure → `[]`.
- `tests/api/test_strategy_builder_models.py` — extend: provider=gemini settings → response
  `provider == "gemini"`, curated models marked available iff the (mocked) listing contains
  them.
- Factory: gemini without API key → `AiMisconfiguredError` naming
  `Q_AI_STRATEGY_GEMINI_API_KEY`; unknown provider message lists both providers.
- Frontend: existing AiStrategyPanel test suite still passes (`pnpm test`); add/adjust one
  case for the provider-aware hint copy.

## Docs

Provider docstring (endpoints, auth header, JSON mode, OpenAI-compat escape hatch). Add the
two new env vars to the backend env/README table where `Q_AI_STRATEGY_*` is documented, with
a worked `.env` example for Gemini.

## Definition of done

`uv run pytest` passes and `pnpm test` passes — do not report completion until both do.
Final message must include: the exact `.env` block that switches the builder to Gemini
(provider/key/model/models lines), the error-mapping table (Gemini failure mode →
`ProviderRequestError` detail), and confirmation that no endpoint or log line can leak the
API key. Production cutover is config-only: the user sets the `.env` block and restarts the
API — no code path defaults to Gemini.

## Out of scope

Streaming responses; multi-turn refinement; per-request provider selection (provider stays a
process-level setting); any change to prompts, parsing, or the compile pipeline; the MT5
gateway batch (WO188–WO190).
