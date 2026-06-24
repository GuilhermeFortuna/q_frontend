# WO107 — Backend: signal-manager registry (OR / AND / Majority)

## Shared context (read first)

Two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, `uv`. Tests: `uv run pytest`. NEVER pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS, `pnpm`. (Not touched here.)

**Context:** We are making **entries composable** like exits — an ordered list of entry
_instances_ combined by a pluggable **signal manager**. This WO builds the manager layer only,
mirroring the existing `exit_rules/` registry. No engine/strategy wiring yet (that is WO108).
Read the design doc `docs/design/multi-entry-composition.md` first — especially **Stance
derivation** and the per-manager `combine` semantics.

## How the pieces work today (read these files)

- `src/q_backend/backtesting/exit_rules/base.py` — `ExitRule` ABC (the structural model to mirror:
  `id`, `label`, `description`, `param_specs()`).
- `src/q_backend/backtesting/exit_rules/registry.py` — `EXIT_RULES` list + `list_exit_rules()` +
  `enabled_rules()` + `all_param_specs()` (the registry shape to mirror).
- `src/q_backend/backtesting/strategy_registry.py` — `StrategyParamSpec` (reuse for manager params)
  and `ExitRuleInfo` (model an analogous `SignalManagerInfo` after it).

## Goal

A small registry of signal managers that turn per-instance **stances** into a net stance:

```python
class Stance(IntEnum):
    SHORT = -1
    FLAT = 0
    LONG = 1

class SignalManager(ABC):
    id: str; label: str; description: str
    def param_specs(self) -> list[StrategyParamSpec]: ...
    def combine(self, stances: list["Stance"]) -> "Stance": ...

get_manager("majority", {"vote_threshold": 2}).combine([Stance.LONG, Stance.LONG, Stance.SHORT])
# -> Stance.LONG
```

## Tasks

### 1. New package `src/q_backend/backtesting/signal_managers/`

- `base.py` — `Stance` (IntEnum as above) and the `SignalManager` ABC. `param_specs()` defaults to
  `[]`. Add a small helper signature `combine(self, stances: list[Stance]) -> Stance`.
- `or_manager.py` — `OrManager` (`id="or"`, label "Any (OR)"):
  net LONG if any LONG and no SHORT; net SHORT if any SHORT and no LONG; else FLAT (disagreement or
  all flat ⇒ FLAT).
- `and_manager.py` — `AndManager` (`id="and"`, label "All (AND)"):
  consider only non-FLAT stances; net LONG iff there is ≥1 non-flat stance and **all** non-flat are
  LONG; symmetric for SHORT; else FLAT.
- `majority.py` — `MajorityManager` (`id="majority"`, label "Majority vote") with one param
  `vote_threshold` (int, default 2, min 1): let `L`/`S` = counts of LONG/SHORT; net LONG if
  `L >= vote_threshold and L > S`; net SHORT if `S >= vote_threshold and S > L`; else FLAT.
- `registry.py` — `SIGNAL_MANAGERS: list[SignalManager]`, plus:
  - `get_manager(kind: str, params: dict[str, Any]) -> SignalManager` (raise `ValueError` on
    unknown kind; managers are stateless singletons but `MajorityManager` needs its `vote_threshold`
    — pass params into a small `configure(params)` or construct per-call. Keep managers immutable:
    store resolved params on the instance returned by `get_manager`).
  - `list_signal_managers() -> list[SignalManagerInfo]` for the catalog.

### 2. Catalog model

In `strategy_registry.py`, add:

```python
class SignalManagerInfo(BaseModel):
    id: str
    label: str
    description: str
    param_names: list[str]
```

`list_signal_managers()` returns one `SignalManagerInfo` per manager.

## Guardrails

> Managers are **pure**: `combine` depends only on its argument list — no I/O, no bar/series
> access, deterministic, no hidden state across bars. (Stance derivation happens in WO108, not
> here.)
> Empty `stances` ⇒ `Stance.FLAT` for every manager (defensive).
> Mirror `exit_rules` structure and naming so the two registries read identically.

## Tests

`tests/backtesting/test_signal_managers.py`:

- OR: `[LONG, FLAT] -> LONG`; `[LONG, SHORT] -> FLAT`; `[FLAT, FLAT] -> FLAT`; `[SHORT, FLAT] -> SHORT`.
- AND: `[LONG, LONG] -> LONG`; `[LONG, FLAT] -> LONG` (flats ignored, all non-flat agree);
  `[LONG, SHORT] -> FLAT`; `[FLAT, FLAT] -> FLAT`.
- Majority (threshold 2): `[LONG, LONG, SHORT] -> LONG`; `[LONG, SHORT] -> FLAT` (tie);
  `[LONG, FLAT, FLAT] -> FLAT` (below threshold); threshold 1: `[LONG, FLAT] -> LONG`.
- `get_manager("nope", {})` raises `ValueError`.
- `list_signal_managers()` returns the 3 managers with `param_names` (`majority` → `["vote_threshold"]`).

## Docs

- None beyond the design doc (already written).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: list the three manager ids and the `combine` truth table you verified.

## Out of scope

- `CompositeEntryStrategy`, stance derivation, factory/engine wiring — **WO108**.
- API schema / catalog endpoint — **WO109**.
