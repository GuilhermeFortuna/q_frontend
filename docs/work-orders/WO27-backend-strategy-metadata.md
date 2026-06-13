# WO27 — Backend: strategy presentation metadata (category, thesis, regime notes, param hints)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Backtest Workbench") redesigns the Backtests page
from a thin config sidebar into a strategy-first workbench. The frontend (WO28) will show
each strategy as a card in a library, with a detail panel that explains _the argument_ for
the strategy — why the edge might exist, which market regimes it likes and hates — and
inline explanations next to each parameter input. All of that text must live in the
**backend registry**, next to the strategy code it describes, so it versions with the
strategies and stays available to any future client. Today `StrategyInfo` carries only a
one-line `description` (e.g. "Signal-line crossovers on MACD."). This work order extends
the registry schema and writes the actual content for every registered strategy. It is
**backend only** and strictly **additive** — the existing frontend must keep working
unmodified against the new response.

---

## How the backend works today (read these files)

- `src/q_backend/backtesting/strategy_registry.py` — `StrategyParamSpec`, `StrategyInfo`,
  `StrategiesResponse`, and `register_strategy(...)`. This is the schema you extend.
- `src/q_backend/api/main.py` — find the `/api/v1/strategies` endpoint and check whether
  it re-declares its own response model (there is a `description: str` field around line
  1. or returns `StrategiesResponse` directly. If a mirror model exists, extend it
     identically — the two must not drift.
- `src/q_backend/backtesting/strategies/` — candle strategies, each ending in a
  `register_strategy(...)` call: `ma_crossover.py`, `macd.py`, `rsi_mean_reversion.py`,
  `bollinger_reversion.py`, `donchian_breakout.py`, `fma.py`, `vma.py`, `trb.py`,
  `tsmom.py`.
- `src/q_backend/backtesting/tick/strategies/` — tick-engine strategies (imported at the
  bottom of `strategy_registry.py`). They get the same treatment.
- `tests/api/test_strategies_endpoint.py` — the existing endpoint test to extend.
- The Lai–Lau strategies (FMA, VMA, TRB) and TSMOM cite their papers in module
  docstrings/comments — read them before writing the thesis texts so the content is
  grounded in the actual rule, not generic indicator lore.

---

## Goal

`GET /api/v1/strategies` returns, for every strategy: a **category**, a multi-sentence
**thesis** (the argument for the strategy), one-line **regime notes** (where it works,
where it bleeds), and an optional **hint** per parameter — without changing the shape or
meaning of any existing field.

## Tasks

### 1. Schema — `strategy_registry.py`

Extend the Pydantic models with optional, defaulted fields (additive — old callers and
old tests must pass untouched):

```python
StrategyCategory = Literal["trend", "mean_reversion", "breakout", "momentum", "other"]

class StrategyParamSpec(BaseModel):
    ...                          # existing fields unchanged
    hint: str | None = None      # one line: what turning this knob does

class StrategyInfo(BaseModel):
    ...                          # existing fields unchanged
    category: StrategyCategory = "other"
    thesis: str = ""             # 2–4 sentences: the argument for the strategy
    strong_in: str = ""          # one line: regimes/conditions it likes
    weak_in: str = ""            # one line: regimes/conditions it bleeds in
```

`register_strategy(...)` gains the matching keyword-only optional parameters and passes
them through to `StrategyInfo`.

### 2. Content — every registered strategy

For **each** strategy registered in `strategies/` and `tick/strategies/`, fill in
`category`, `thesis`, `strong_in`, `weak_in`, and a `hint` on every parameter. Quality
bar, per field:

- `**thesis`\** answers *why would this make money?\* in plain language — the behavioral or
  structural argument, then the mechanical rule in one sentence. Example for MACrossover:
  the persistence-of-trends argument, then "long while the fast average is above the slow
  one, flat/short when it flips; accepts whipsaw losses in ranges as the price of catching
  every large trend." Do not restate the parameter list. Do not write marketing copy.
- For the academic strategies (FMA/VMA/TRB from Lai–Lau 2006; TSMOM from
  Moskowitz–Ooi–Pedersen 2012), name the paper in the thesis — that _is_ the argument.
- `**strong_in` / `weak_in*`\* are honest one-liners ("sustained directional trends" /
  "choppy ranges — repeated whipsaw entries"). Every strategy has a `weak_in`; if you
  can't name one, you haven't understood the strategy.
- `**hint**` says what moving the knob trades off, not what the parameter is called
  ("shorter = more trades, more noise" — not "the period of the short MA").
- Categories: MACrossover/MACD/FMA/VMA → `trend`; RSIMeanReversion/BollingerReversion →
  `mean_reversion`; DonchianBreakout/TRB → `breakout`; TSMOM → `momentum`. Categorize any
  tick strategies yourself by the same logic.

### 3. Endpoint

Confirm the new fields flow through `/api/v1/strategies`. If `main.py` mirrors the model,
update the mirror. No other endpoint changes.

### 4. Tests

Extend `tests/api/test_strategies_endpoint.py`:

- Response includes `category`, `thesis`, `strong_in`, `weak_in` for every strategy, and
  every strategy has a **non-empty** `thesis` and a valid category (this is the test that
  keeps future strategies honest — registering a strategy without a thesis should fail CI).
- Every param of every strategy has a non-empty `hint`.
- A registry-level unit test: `register_strategy` without the new kwargs still works and
  yields the documented defaults (proves additivity).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing tests pass **unmodified** — if you had to edit a pre-existing test, the change
  was not additive; rethink it.
- In your **completion message, paste one full strategy object** from the live
  `/api/v1/strategies` response (MACrossover) — WO28 builds its types and fallbacks
  against that JSON.

## Out of scope

- Any frontend change (WO28).
- New strategies, changes to strategy logic, params, defaults, or engine behavior.
- Localization of the texts (English only for now).
- Per-strategy images/sparkline data (frontend renders icons; revisit later if wanted).
